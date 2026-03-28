using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace MiInventarioLauncher;

class Program
{
    // Paths relativos al .exe
    static string BaseDir = AppDomain.CurrentDomain.BaseDirectory;
    static string PgBin => Path.Combine(BaseDir, "postgresql", "bin");
    static string PgData => Path.Combine(BaseDir, "postgresql", "data");
    static string PgLog => Path.Combine(BaseDir, "postgresql", "log.txt");
    static string PythonExe => Path.Combine(BaseDir, "python", "python.exe");
    static string BackendDir => Path.Combine(BaseDir, "backend");
    static string MediaDir => Path.Combine(BackendDir, "media");
    static string FrontendDir => Path.Combine(BaseDir, "frontend");
    const string Url = "http://localhost:8000";
    const int PG_PORT = 5432;

    static Process? uvicornProcess;
    static bool pgStartedByUs = false;

    static async Task<int> Main(string[] args)
    {
        Console.Title = "Mi Inventario Fácil";
        SetConsoleColor(ConsoleColor.Cyan);

        PrintBanner();

        // Verificar prerequisitos
        if (!File.Exists(Path.Combine(PgBin, "pg_ctl.exe")))
        {
            PrintError("PostgreSQL no encontrado en postgresql\\bin\\");
            WaitExit(); return 1;
        }
        if (!Directory.Exists(PgData))
        {
            PrintError("Base de datos no inicializada. Ejecute setup.bat primero.");
            WaitExit(); return 1;
        }
        if (!File.Exists(PythonExe))
        {
            PrintError("Python no encontrado en python\\");
            WaitExit(); return 1;
        }

        // Crear media si no existe
        Directory.CreateDirectory(MediaDir);

        try
        {
            // Paso 1: PostgreSQL
            PrintStep(1, 4, "Iniciando base de datos...");
            if (!await StartPostgreSQL())
            {
                PrintError("PostgreSQL no pudo iniciar. Revise postgresql\\log.txt");
                WaitExit(); return 1;
            }
            PrintOk("Base de datos lista");

            // Paso 2: Servidor web
            PrintStep(2, 4, "Iniciando servidor web...");
            StartUvicorn();
            PrintOk("Servidor web iniciado");

            // Paso 3: Esperar respuesta
            PrintStep(3, 4, "Cargando aplicación...");
            bool ready = await WaitForServer(45);
            if (!ready)
            {
                PrintError("El servidor no respondió después de 45 segundos.");
                PrintInfo("Revise la consola arriba para errores de Python/uvicorn.");
                StopAll();
                WaitExit(); return 1;
            }
            PrintOk("Aplicación cargada");

            // Paso 4: Abrir navegador
            PrintStep(4, 4, "Abriendo navegador...");
            OpenBrowser(Url);
            PrintOk("Navegador abierto");

            // Panel de control
            Console.WriteLine();
            PrintPanel();

            // Esperar Enter para detener
            Console.ReadLine();
        }
        catch (Exception ex)
        {
            PrintError($"Error inesperado: {ex.Message}");
            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.WriteLine(ex.StackTrace);
        }
        finally
        {
            Console.WriteLine();
            PrintStep(0, 0, "Deteniendo servicios...");
            StopAll();
            PrintOk("Todos los servicios detenidos. ¡Hasta luego!");
            Thread.Sleep(1500);
        }

        return 0;
    }

    // ═══════════════════════════════════════════════
    // PostgreSQL
    // ═══════════════════════════════════════════════
    static bool IsPgRunning()
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = Path.Combine(PgBin, "pg_isready.exe"),
                Arguments = "-h localhost -p 5432 -U postgres",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            var p = Process.Start(psi);
            p?.WaitForExit(5000);
            return p?.ExitCode == 0;
        }
        catch { return false; }
    }

    static async Task<bool> StartPostgreSQL()
    {
        if (IsPgRunning())
        {
            PrintInfo("PostgreSQL ya estaba corriendo");
            return true;
        }

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = Path.Combine(PgBin, "pg_ctl.exe"),
                Arguments = $"start -D \"{PgData}\" -l \"{PgLog}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            var p = Process.Start(psi);
            // No esperar a que pg_ctl termine — polling con pg_isready
        }
        catch (Exception ex)
        {
            PrintError($"Error iniciando pg_ctl: {ex.Message}");
            return false;
        }

        // Polling: esperar hasta 15 segundos
        for (int i = 0; i < 15; i++)
        {
            await Task.Delay(1000);
            PrintProgress(i + 1, 15);
            if (IsPgRunning())
            {
                pgStartedByUs = true;
                Console.WriteLine();
                return true;
            }
        }
        Console.WriteLine();
        return false;
    }

    // ═══════════════════════════════════════════════
    // Uvicorn (FastAPI)
    // ═══════════════════════════════════════════════
    static void StartUvicorn()
    {
        var psi = new ProcessStartInfo
        {
            FileName = PythonExe,
            Arguments = "-m uvicorn backend.main:app --host 0.0.0.0 --port 8000",
            WorkingDirectory = BaseDir,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        psi.EnvironmentVariables["PYTHONPATH"] = BaseDir;
        psi.EnvironmentVariables["PYTHONIOENCODING"] = "utf-8";
        psi.EnvironmentVariables["PYTHONUTF8"] = "1";

        uvicornProcess = Process.Start(psi);

        // Leer stdout/stderr en background para debug
        if (uvicornProcess != null)
        {
            Task.Run(() => ReadStream(uvicornProcess.StandardOutput, ConsoleColor.DarkGray));
            Task.Run(() => ReadStream(uvicornProcess.StandardError, ConsoleColor.DarkYellow));
        }
    }

    static void ReadStream(StreamReader reader, ConsoleColor color)
    {
        try
        {
            while (!reader.EndOfStream)
            {
                var line = reader.ReadLine();
                if (line != null)
                {
                    Console.ForegroundColor = color;
                    Console.WriteLine($"  [SERVER] {line}");
                    Console.ResetColor();
                }
            }
        }
        catch { }
    }

    // ═══════════════════════════════════════════════
    // Wait for HTTP
    // ═══════════════════════════════════════════════
    static async Task<bool> WaitForServer(int timeoutSeconds)
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        for (int i = 0; i < timeoutSeconds; i++)
        {
            PrintProgress(i + 1, timeoutSeconds);
            try
            {
                var resp = await http.GetAsync(Url);
                if (resp.IsSuccessStatusCode)
                {
                    Console.WriteLine();
                    return true;
                }
            }
            catch { }
            await Task.Delay(1000);
        }
        Console.WriteLine();
        return false;
    }

    // ═══════════════════════════════════════════════
    // Stop
    // ═══════════════════════════════════════════════
    static void StopAll()
    {
        // Detener uvicorn
        if (uvicornProcess != null && !uvicornProcess.HasExited)
        {
            try
            {
                uvicornProcess.Kill(true);
                uvicornProcess.WaitForExit(5000);
            }
            catch { }
        }

        // Detener PostgreSQL
        if (pgStartedByUs)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = Path.Combine(PgBin, "pg_ctl.exe"),
                    Arguments = $"stop -D \"{PgData}\" -m fast",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                var p = Process.Start(psi);
                p?.WaitForExit(10000);
            }
            catch { }
        }
    }

    // ═══════════════════════════════════════════════
    // Browser
    // ═══════════════════════════════════════════════
    static void OpenBrowser(string url)
    {
        try
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch { }
    }

    // ═══════════════════════════════════════════════
    // UI Helpers
    // ═══════════════════════════════════════════════
    static void SetConsoleColor(ConsoleColor fg)
    {
        Console.ForegroundColor = fg;
    }

    static void PrintBanner()
    {
        Console.ForegroundColor = ConsoleColor.Blue;
        Console.WriteLine();
        Console.WriteLine("  ╔══════════════════════════════════════════════════════╗");
        Console.WriteLine("  ║                                                      ║");
        Console.ForegroundColor = ConsoleColor.White;
        Console.Write("  ║     ");
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.Write("Mi Inventario Fácil");
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine("                          ║");
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write("  ║     ");
        Console.Write("Sistema de Gestión de Negocios v1.0");
        Console.ForegroundColor = ConsoleColor.Blue;
        Console.WriteLine("         ║");
        Console.WriteLine("  ║                                                      ║");
        Console.WriteLine("  ╚══════════════════════════════════════════════════════╝");
        Console.ResetColor();
        Console.WriteLine();
    }

    static void PrintStep(int step, int total, string message)
    {
        Console.ForegroundColor = ConsoleColor.DarkCyan;
        if (total > 0)
            Console.Write($"  [{step}/{total}] ");
        else
            Console.Write("  [···] ");
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine(message);
        Console.ResetColor();
    }

    static void PrintOk(string message)
    {
        Console.ForegroundColor = ConsoleColor.Green;
        Console.Write("    ✓ ");
        Console.ForegroundColor = ConsoleColor.Gray;
        Console.WriteLine(message);
        Console.ResetColor();
    }

    static void PrintError(string message)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.Write("    ✗ ");
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine(message);
        Console.ResetColor();
    }

    static void PrintInfo(string message)
    {
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine($"    ℹ {message}");
        Console.ResetColor();
    }

    static void PrintProgress(int current, int total)
    {
        int barWidth = 30;
        int filled = (int)((double)current / total * barWidth);
        Console.ForegroundColor = ConsoleColor.DarkCyan;
        Console.Write($"\r    [");
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.Write(new string('█', filled));
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write(new string('░', barWidth - filled));
        Console.ForegroundColor = ConsoleColor.DarkCyan;
        Console.Write($"] {current * 100 / total,3}%");
        Console.ResetColor();
    }

    static void PrintPanel()
    {
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("  ╔══════════════════════════════════════════════════════╗");
        Console.WriteLine("  ║                                                      ║");
        Console.ForegroundColor = ConsoleColor.White;
        Console.Write("  ║  ");
        Console.ForegroundColor = ConsoleColor.Green;
        Console.Write("✓");
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine("  Mi Inventario Fácil está corriendo              ║");
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("  ║                                                      ║");
        Console.ForegroundColor = ConsoleColor.Gray;
        Console.Write("  ║  URL:        ");
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.Write(Url);
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("                    ║");
        Console.ForegroundColor = ConsoleColor.Gray;
        Console.Write("  ║  Usuario:    ");
        Console.ForegroundColor = ConsoleColor.White;
        Console.Write("admin");
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("                               ║");
        Console.ForegroundColor = ConsoleColor.Gray;
        Console.Write("  ║  Contraseña: ");
        Console.ForegroundColor = ConsoleColor.White;
        Console.Write("admin123");
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("                            ║");
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("  ║                                                      ║");
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write("  ║  ");
        Console.Write("Tablet/celular: http://[IP-de-esta-PC]:8000");
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("     ║");
        Console.WriteLine("  ║                                                      ║");
        Console.WriteLine("  ╠══════════════════════════════════════════════════════╣");
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.Write("  ║  ");
        Console.Write("Presione ENTER para detener el servidor");
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("            ║");
        Console.WriteLine("  ╚══════════════════════════════════════════════════════╝");
        Console.ResetColor();
        Console.WriteLine();
    }

    static void WaitExit()
    {
        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write("  Presione Enter para salir...");
        Console.ResetColor();
        Console.ReadLine();
    }
}
