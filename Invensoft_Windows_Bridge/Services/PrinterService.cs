using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows; // Added for MessageBox
using Scriban;
using Scriban.Runtime;
using Newtonsoft.Json.Linq;

namespace Invensoft_Windows_Bridge.Services
{
    public class PrinterService
    {
        // ESC/POS Commands
        private static readonly byte[] CMD_INIT = { 0x1b, 0x40 };
        private static readonly byte[] CMD_CUT = { 0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00 };
        
        // Alignment
        private static readonly byte[] CMD_ALIGN_LEFT = { 0x1b, 0x61, 0x00 };
        private static readonly byte[] CMD_ALIGN_CENTER = { 0x1b, 0x61, 0x01 };
        private static readonly byte[] CMD_ALIGN_RIGHT = { 0x1b, 0x61, 0x02 };
        
        // Font Styles
        private static readonly byte[] CMD_BOLD_ON = { 0x1b, 0x45, 0x01 };
        private static readonly byte[] CMD_BOLD_OFF = { 0x1b, 0x45, 0x00 };

        public async Task<bool> ExecutePrintAsync(string printerName, string templateStr, JObject contextData, string printerMode = "WINDOWS")
        {
            try
            {
                // 1. Render Template with Scriban (replaces Jinja2)
                var template = Template.Parse(templateStr);
                
                // Convert JObject to Dictionary for Scriban
                var scriptObject = new ScriptObject();
                foreach (var prop in contextData.Properties())
                {
                    scriptObject.Add(prop.Name, ConvertJTokenToObject(prop.Value));
                }
                
                var context = new TemplateContext();
                context.PushGlobal(scriptObject);
                
                string renderedText = await template.RenderAsync(context);
                
                // --- VIRTUAL MODE CHECK ---
                if (printerMode.ToUpper() == "VIRTUAL")
                {
                    return ExecuteVirtualPrint(renderedText);
                }

                // 2. Parse Tags and Build Byte Array
                byte[] rawData = BuildEscPosData(renderedText);
                
                // 3. Send to Windows Spooler
                return RawPrinterHelper.SendBytesToPrinter(printerName, rawData);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Print Error: {ex.Message}");
                System.Windows.MessageBox.Show($"Error General de Impresión:\n{ex.Message}", "ErrorCrítico", MessageBoxButton.OK, MessageBoxImage.Error);
                return false;
            }
        }

        private bool ExecuteVirtualPrint(string renderedText)
        {
            try
            {
                var sb = new StringBuilder();
                int width = 48;
                sb.AppendLine("--- INICIO TICKET VIRTUAL ---");
                
                string[] lines = renderedText.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
                foreach (var lineRaw in lines)
                {
                    string content = lineRaw.Trim();
                    if (string.IsNullOrEmpty(content)) continue;

                    if (content.Contains("<cut>"))
                    {
                        sb.AppendLine(new string('-', width) + " [CORTE] " + new string('-', width));
                        content = content.Replace("<cut>", "");
                    }

                    // Strip other tags for clean text view
                    content = content.Replace("<bold>", "").Replace("</bold>", "")
                                     .Replace("<center>", "").Replace("</center>", "")
                                     .Replace("<right>", "").Replace("</right>", "")
                                     .Replace("<left>", "").Replace("</left>", "");
                    
                    if (!string.IsNullOrWhiteSpace(content))
                    {
                        sb.AppendLine(content);
                    }
                }
                sb.AppendLine("--- FIN TICKET VIRTUAL ---");

                // Save to Desktop for visibility
                string path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "ticket_virtual_output.txt");
                File.WriteAllText(path, sb.ToString());
                
                System.Windows.MessageBox.Show($"Ticket Virtual guardado en:\n{path}", "Impresión Virtual Exitosa", MessageBoxButton.OK, MessageBoxImage.Information);
                return true;
            }
            catch (Exception ex) 
            {
                Console.WriteLine($"Virtual Print Error: {ex.Message}");
                System.Windows.MessageBox.Show($"Error guardando ticket virtual:\n{ex.Message}", "Error de Impresión", MessageBoxButton.OK, MessageBoxImage.Error);
                return false;
            }
        }

        private object ConvertJTokenToObject(JToken token)
        {
            if (token is JValue value)
                return value.Value;
            
            if (token is JArray array)
            {
                var list = new List<object>();
                foreach (var item in array)
                    list.Add(ConvertJTokenToObject(item));
                return list;
            }

            if (token is JObject obj)
            {
                var dict = new ScriptObject();
                foreach (var prop in obj.Properties())
                    dict.Add(prop.Name, ConvertJTokenToObject(prop.Value));
                return dict;
            }

            return null;
        }

        private byte[] BuildEscPosData(string renderedText)
        {
            List<byte> buffer = new List<byte>();
            
            // Initialize Printer
            buffer.AddRange(CMD_INIT);
            
            // Split by lines to process tags per line like Python script
            string[] lines = renderedText.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
            
            foreach (string lineRaw in lines)
            {
                string line = lineRaw.Trim();
                if (string.IsNullOrEmpty(line)) continue;

                // State for this line
                byte[] alignCmd = CMD_ALIGN_LEFT;
                bool isBold = false;
                bool isCut = false;
                
                string content = line;

                // Parse Tags
                if (content.Contains("<center>"))
                {
                    alignCmd = CMD_ALIGN_CENTER;
                    content = content.Replace("<center>", "").Replace("</center>", "");
                }
                if (content.Contains("<right>"))
                {
                    alignCmd = CMD_ALIGN_RIGHT;
                    content = content.Replace("<right>", "").Replace("</right>", "");
                }
                if (content.Contains("<left>"))
                {
                    alignCmd = CMD_ALIGN_LEFT;
                    content = content.Replace("<left>", "").Replace("</left>", "");
                }
                
                if (content.Contains("<bold>"))
                {
                    isBold = true;
                    content = content.Replace("<bold>", "").Replace("</bold>", "");
                }
                
                if (content.Contains("<cut>"))
                {
                    isCut = true;
                    content = content.Replace("<cut>", "");
                }

                // If it's just a cut command
                if (isCut && string.IsNullOrWhiteSpace(content))
                {
                    buffer.AddRange(CMD_CUT);
                    continue;
                }
                
                // --- Build Line Commands ---
                
                // 1. Alignment
                buffer.AddRange(alignCmd);
                
                // 2. Bold On
                if (isBold) buffer.AddRange(CMD_BOLD_ON);
                
                // 3. Content (UTF-8 or CP437 fallback)
                // Python script tried UTF-8 then CP437. We'll stick to 850 (Latin1) or similar for printers usually.
                // Or standard UTF-8 if printer supports it. Let's try 850 (West Europe) or 437 (US).
                // Modern printers often support UTF-8 but 437/850 is safer for legacy.
                // Let's use 850 for accents.
                try 
                {
                    // Using CodePage 850 (Multilingual Latin 1) common in thermal printers
                    Encoding enc = Encoding.GetEncoding(850); 
                    buffer.AddRange(enc.GetBytes(content));
                }
                catch 
                {
                    // Fallback to ASCII
                    buffer.AddRange(Encoding.ASCII.GetBytes(content));
                }
                
                // 4. New Line
                buffer.Add(0x0A); // LF
                
                // 5. Bold Off
                if (isBold) buffer.AddRange(CMD_BOLD_OFF);
                
                // 6. Reset Align
                buffer.AddRange(CMD_ALIGN_LEFT);
                
                // 7. Cut if requested at end of line
                if (isCut) buffer.AddRange(CMD_CUT);
            }
            
            return buffer.ToArray();
        }
    }

    // --- Win32 Spooler Helper ---
    public static class RawPrinterHelper
    {
        // Structure and API declarions:
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
        public class DOCINFOA
        {
            [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
            [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
            [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
        }
        
        [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

        [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

        [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

        public static bool SendBytesToPrinter(string szPrinterName, byte[] pBytes)
        {
            Int32 dwError = 0, dwWritten = 0;
            IntPtr hPrinter = new IntPtr(0);
            DOCINFOA di = new DOCINFOA();
            bool bSuccess = false;

            di.pDocName = "Invensoft Ticket";
            di.pDataType = "RAW";

            if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero))
            {
                if (StartDocPrinter(hPrinter, 1, di))
                {
                    if (StartPagePrinter(hPrinter))
                    {
                        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(pBytes.Length);
                        Marshal.Copy(pBytes, 0, pUnmanagedBytes, pBytes.Length);
                        
                        bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, pBytes.Length, out dwWritten);
                        
                        Marshal.FreeCoTaskMem(pUnmanagedBytes);
                        EndPagePrinter(hPrinter);
                    }
                    EndDocPrinter(hPrinter);
                }
                ClosePrinter(hPrinter);
            }
            
            if (!bSuccess)
            {
                dwError = Marshal.GetLastWin32Error();
                Console.WriteLine($"Win32 Error: {dwError}");
            }
            return bSuccess;
        }
    }
}
