using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace Invensoft_Windows_Bridge.Services
{
    public class WebSocketService
    {
        private ClientWebSocket _ws;
        private readonly AppConfig _config;
        private readonly PrinterService _printerService;
        private CancellationTokenSource _cts;
        private bool _isConnecting = false;

        public event Action<string> OnStatusChanged;

        public WebSocketService(AppConfig config)
        {
            _config = config;
            _printerService = new PrinterService();
        }

        public async Task StartAsync()
        {
            if (_isConnecting) return;
            _isConnecting = true;
            _cts = new CancellationTokenSource();

            await Task.Factory.StartNew(async () =>
            {
                while (!_cts.Token.IsCancellationRequested)
                {
                    try
                    {
                        await ConnectAndListenAsync(_cts.Token);
                    }
                    catch (Exception ex)
                    {
                        NotifyStatus($"❌ Error crítico: {ex.Message}. Reintentando en 5s...");
                        await Task.Delay(5000, _cts.Token);
                    }
                }
            }, _cts.Token, TaskCreationOptions.LongRunning, TaskScheduler.Default);
        }

        public void Stop()
        {
            _cts?.Cancel();
            _ws?.Dispose();
            _isConnecting = false;
        }

        private async Task ConnectAndListenAsync(CancellationToken token)
        {
            // Ensure correct WS scheme
            var host = _config.Host;
            // Ensure correct WS scheme
            if (host.StartsWith("http://")) host = host.Replace("http://", "ws://");
            else if (host.StartsWith("https://")) host = host.Replace("https://", "wss://");
            else if (!host.StartsWith("ws://") && !host.StartsWith("wss://")) host = "ws://" + host;

            // Build URL with Query Params
            var url = $"{host}/api/v1/ws/hardware/connect?client_id={_config.ClientId}&tenant_id={_config.TenantId}&token={_config.AuthToken}";

            using (_ws = new ClientWebSocket())
            {
                // Traefik Keep-Alive settings
                _ws.Options.KeepAliveInterval = TimeSpan.FromSeconds(20);
                
                // Fix 403 Forbidden: Set Origin Header
                _ws.Options.SetRequestHeader("Origin", "https://app.miinventariofacil.com");

                NotifyStatus($"🔌 Conectando a {host}...");
                
                try 
                {
                    await _ws.ConnectAsync(new Uri(url), token);
                }
                catch (WebSocketException wsex)
                {
                    NotifyStatus($"❌ Error de Conexión: {wsex.Message}");
                     // Show detailed error for debugging
                     // System.Windows.MessageBox.Show($"Error conectando a: {url}\n\nDetalle: {wsex.Message}", "Debug Conexión");
                    throw; // Trigger retry loop
                }

                NotifyStatus("✅ Conectado y Esperando Trabajos");

                // Start Background Ping Loop (Application Level for Traefik/Backend compatibility)
                _ = Task.Run(async () => await PingLoopAsync(token));

                // Receive Loop
                var buffer = new byte[1024 * 4];
                
                while (_ws.State == WebSocketState.Open && !token.IsCancellationRequested)
                {
                    using (var ms = new System.IO.MemoryStream())
                    {
                        WebSocketReceiveResult result;
                        do
                        {
                            result = await _ws.ReceiveAsync(new ArraySegment<byte>(buffer), token);
                            if (result.MessageType == WebSocketMessageType.Close)
                            {
                                await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", token);
                                return; // Exit loop
                            }
                            ms.Write(buffer, 0, result.Count);
                        }
                        while (!result.EndOfMessage);

                        if (result.MessageType == WebSocketMessageType.Text)
                        {
                            var message = Encoding.UTF8.GetString(ms.ToArray());
                            await HandleMessageAsync(message);
                        }
                    }
                }
            }
        }

        private async Task PingLoopAsync(CancellationToken token)
        {
            while (_ws.State == WebSocketState.Open && !token.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(20000, token); // 20s
                    var bytes = Encoding.UTF8.GetBytes("ping");
                    await _ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, token);
                }
                catch
                {
                    break; 
                }
            }
        }

        private async Task HandleMessageAsync(string message)
        {
            if (message == "pong") return;

            try
            {
                NotifyStatus($"📩 Mensaje recibido ({message.Length} bytes)");
                // NotifyStatus($"Contenido: {message.Substring(0, Math.Min(message.Length, 50))}...");

                var json = JObject.Parse(message);
                var type = json["type"]?.ToString();

                if (type == "print")
                {
                    NotifyStatus("🖨️ Recibido trabajo de impresión...");
                    
                    var payload = json["payload"] as JObject;
                    if (payload != null)
                    {
                        string template = payload["template"]?.ToString() ?? "";
                        var context = payload["context"] as JObject ?? new JObject();
                        string target = payload["target"]?.ToString() ?? "default";

                        // Map target if needed, for now just use default printer from config
                        string printerName = _config.PrinterName;

                        bool success = await _printerService.ExecutePrintAsync(printerName, template, context, _config.PrinterMode);
                        
                        if (success) NotifyStatus($"✅ Impresión correcta ({DateTime.Now:HH:mm:ss})");
                        else NotifyStatus($"❌ Error al imprimir ({DateTime.Now:HH:mm:ss})");
                    }
                }
                else if (type == "conn_ack")
                {
                    NotifyStatus($"✅ Servidor Aceptó Conexión: {json["status"]}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error processing message: {ex.Message}");
            }
        }

        private void NotifyStatus(string msg)
        {
            OnStatusChanged?.Invoke(msg);
        }
    }
}
