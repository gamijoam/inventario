using System;
using System.Windows;
using System.Web; // Requires reference, but we can use string splitting to avoid deps
using Invensoft_Windows_Bridge.Services;
using System.Collections.Specialized;
using System.Text.RegularExpressions;

namespace Invensoft_Windows_Bridge
{
    public partial class App : System.Windows.Application
    {
        private void Application_Startup(object sender, StartupEventArgs e)
        {
            try 
            {
                // 1. Check for Magic Link Args
                if (e.Args.Length > 0)
                {
                    string arg = e.Args[0];
                    if (arg.StartsWith("miinventariofacil:"))
                    {
                        HandleMagicLink(arg);
                    }
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Error en inicio: {ex.Message}");
            }

            // 2. Launch Main Window
            MainWindow mainWindow = new MainWindow();
            mainWindow.Show();
        }

        private void HandleMagicLink(string uriString)
        {
            try
            {
                // Format: miinventariofacil://config?token=...&tenant=...
                // Simple parsing to avoid HttpUtility dependency if not available in client profile
                
                // Remove protocol
                string queryString = uriString.Substring(uriString.IndexOf('?') + 1);
                var queryParams = ParseQueryString(queryString);

                AppConfig config = SettingsManager.Load();
                bool changed = false;

                if (queryParams.ContainsKey("host")) { config.Host = Uri.UnescapeDataString(queryParams["host"]); changed = true; }
                if (queryParams.ContainsKey("token")) { config.AuthToken = queryParams["token"]; changed = true; }
                if (queryParams.ContainsKey("tenant")) { config.TenantId = queryParams["tenant"]; changed = true; }
                if (queryParams.ContainsKey("client")) { config.ClientId = queryParams["client"]; changed = true; }
                if (queryParams.ContainsKey("printer")) { config.PrinterName = Uri.UnescapeDataString(queryParams["printer"]); changed = true; }
                
                if (changed)
                {
                    SettingsManager.Save(config);
                    System.Windows.MessageBox.Show("¡Configuración actualizada exitosamente!", "Miinventariofacil", MessageBoxButton.OK, MessageBoxImage.Information);
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Error procesando enlace mágico: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private System.Collections.Generic.Dictionary<string, string> ParseQueryString(string query)
        {
            var dict = new System.Collections.Generic.Dictionary<string, string>();
            var pairs = query.Split('&');
            foreach (var pair in pairs)
            {
                // Fix: Split only on the FIRST equals sign to handle base64 padding or values with '='
                var parts = pair.Split(new[] { '=' }, 2);
                if (parts.Length == 2)
                {
                    dict[parts[0]] = parts[1];
                }
            }
            return dict;
        }
    }
}
