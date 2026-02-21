using System;
using System.IO;
using Newtonsoft.Json;

namespace Invensoft_Windows_Bridge.Services
{
    public class AppConfig
    {
        public string TenantId { get; set; } = "";
        public string ClientId { get; set; } = "";
        public string AuthToken { get; set; } = "";
        public string Host { get; set; } = "ws://localhost:8000";
        public string PrinterName { get; set; } = "POS-58"; // Default
        public string PrinterMode { get; set; } = "WINDOWS"; // WINDOWS or VIRTUAL
        public int PaperWidth { get; set; } = 58; // 58 or 80
    }

    public static class SettingsManager
    {
        private static readonly string ConfigPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Invensoft",
            "bridge_config.json"
        );

        public static AppConfig Load()
        {
            try
            {
                if (File.Exists(ConfigPath))
                {
                    string json = File.ReadAllText(ConfigPath);
                    return JsonConvert.DeserializeObject<AppConfig>(json) ?? new AppConfig();
                }
            }
            catch (Exception) 
            {
                // Log error or ignore
            }
            return new AppConfig();
        }

        public static void Save(AppConfig config)
        {
            try
            {
                string dir = Path.GetDirectoryName(ConfigPath);
                if (!Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                string json = JsonConvert.SerializeObject(config, Formatting.Indented);
                File.WriteAllText(ConfigPath, json);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error saving config: {ex.Message}");
            }
        }
        
        public static bool IsConfigured()
        {
            var cfg = Load();
            return !string.IsNullOrEmpty(cfg.AuthToken) && !string.IsNullOrEmpty(cfg.TenantId);
        }
    }
}
