using System.Windows;
using Microsoft.Win32;
using System.Diagnostics;
using Invensoft_Windows_Bridge.Services;
using WinForms = System.Windows.Forms;
using System.Drawing;

namespace Invensoft_Windows_Bridge
{
    public partial class MainWindow : Window
    {
        private AppConfig _config;
        private WebSocketService _wsService;
        private WinForms.NotifyIcon _notifyIcon;
        private bool _isExplicitExit = false;
        private const string RUN_REGISTRY_KEY = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
        private const string APP_NAME = "InvensoftBridge";

        public MainWindow()
        {
            InitializeComponent();
            LoadConfig();
            RegisterProtocol(false);
            InitializeTrayIcon();
        }

        private void InitializeTrayIcon()
        {
            _notifyIcon = new WinForms.NotifyIcon();
            // Use a default system icon or embedded resource if available
            _notifyIcon.Icon = SystemIcons.Application; 
            _notifyIcon.Visible = true;
            _notifyIcon.Text = "Conexion Impresora - Segundo Plano";
            _notifyIcon.DoubleClick += (s, args) => 
            {
                Show();
                WindowState = WindowState.Normal;
            };

            var contextMenu = new WinForms.ContextMenuStrip();
            contextMenu.Items.Add("Abrir", null, (s, e) => { Show(); WindowState = WindowState.Normal; });
            contextMenu.Items.Add("-");
            contextMenu.Items.Add("Salir", null, (s, e) => { 
                _isExplicitExit = true;
                Close(); 
            });
            _notifyIcon.ContextMenuStrip = contextMenu;
        }

        protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
        {
            if (!_isExplicitExit)
            {
                e.Cancel = true;
                Hide();
                _notifyIcon.ShowBalloonTip(3000, "Conexion Impresora", "La aplicación sigue ejecutándose en segundo plano.", WinForms.ToolTipIcon.Info);
            }
            else
            {
                _notifyIcon.Dispose();
                if (_wsService != null) _wsService.Stop();
                base.OnClosing(e);
            }
        }

        private void LoadConfig()
        {
            _config = SettingsManager.Load();
            
            // Default View: Welcome Panel
            SetupPanel.Visibility = Visibility.Collapsed;
            WelcomePanel.Visibility = Visibility.Visible;

            // Pre-fill fields
            txtTenantId.Text = _config.TenantId;
            txtClientId.Text = _config.ClientId;
            txtHost.Text = string.IsNullOrEmpty(_config.Host) ? "ws://127.0.0.1:8000" : _config.Host;
            txtPrinter.Text = _config.PrinterName;
            txtTokenBox.Password = _config.AuthToken;
            
            chkVirtualMode.IsChecked = (_config.PrinterMode == "VIRTUAL");
            txtPrinter.IsEnabled = !chkVirtualMode.IsChecked.Value;

            CheckAutoStartStatus();
            
            if (SettingsManager.IsConfigured())
            {
                Log($"⚡ Configuración cargada. Tenant: {_config.TenantId}");
                StartBridge();
            }
            else
            {
                Log("⚠️ No hay configuración guardada. Esperando...");
            }
        }

        private void BtnManualConfig_Click(object sender, RoutedEventArgs e)
        {
            WelcomePanel.Visibility = Visibility.Collapsed;
            SetupPanel.Visibility = Visibility.Visible;
        }

        private void BtnBackToWelcome_Click(object sender, RoutedEventArgs e)
        {
            SetupPanel.Visibility = Visibility.Collapsed;
            WelcomePanel.Visibility = Visibility.Visible;
        }

        private void ChkVirtualMode_Changed(object sender, RoutedEventArgs e)
        {
            if (chkVirtualMode.IsChecked == true)
            {
                txtPrinter.IsEnabled = false;
            }
            else
            {
                txtPrinter.IsEnabled = true;
            }
        }

        private void ChkAutoStart_Checked(object sender, RoutedEventArgs e)
        {
            SetAutoStart(true);
        }

        private void ChkAutoStart_Unchecked(object sender, RoutedEventArgs e)
        {
            SetAutoStart(false);
        }

        private void SetAutoStart(bool enable)
        {
            try
            {
                using (Microsoft.Win32.RegistryKey key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(RUN_REGISTRY_KEY, true))
                {
                    if (enable)
                    {
                        string exePath = System.Diagnostics.Process.GetCurrentProcess().MainModule.FileName;
                        key.SetValue(APP_NAME, $"\"{exePath}\"");
                        Log("🚀 Auto-Inicio activado.");
                    }
                    else
                    {
                        key.DeleteValue(APP_NAME, false);
                        Log("🛑 Auto-Inicio desactivado.");
                    }
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Error cambiando auto-inicio: {ex.Message}");
            }
        }

        private void CheckAutoStartStatus()
        {
            try
            {
                using (Microsoft.Win32.RegistryKey key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(RUN_REGISTRY_KEY, false))
                {
                    object val = key.GetValue(APP_NAME);
                    chkAutoStart.IsChecked = (val != null);
                }
            }
            catch { }
        }



        private void StartBridge()
        {
            if (_wsService != null)
            {
                _wsService.Stop();
            }

            _wsService = new WebSocketService(_config);
            _wsService.OnStatusChanged += Log;

            // Start in background
            Log("🚀 Iniciando servicio de puente...");

            // Start in background
            _ = _wsService.StartAsync();
        }

        private void BtnSave_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(txtTenantId.Text) || string.IsNullOrWhiteSpace(txtTokenBox.Password) || string.IsNullOrWhiteSpace(txtHost.Text))
            {
                System.Windows.MessageBox.Show("Por favor complete todos los campos requeridos.", "Error", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            Log("💾 Guardando configuración manual...");

            _config.TenantId = txtTenantId.Text.Trim();
            _config.ClientId = txtClientId.Text.Trim();
            _config.Host = txtHost.Text.Trim();
            _config.AuthToken = txtTokenBox.Password.Trim();
            _config.PrinterName = txtPrinter.Text.Trim();
            _config.PrinterMode = (chkVirtualMode.IsChecked == true) ? "VIRTUAL" : "WINDOWS";
            
            SettingsManager.Save(_config);
            
            // Hide setup, show welcome/logs
            SetupPanel.Visibility = Visibility.Collapsed;
            WelcomePanel.Visibility = Visibility.Visible;
            
            StartBridge();
        }

        private void BtnUnlink_Click(object sender, RoutedEventArgs e)
        {
            if (_wsService != null) _wsService.Stop();

            _config.AuthToken = "";
            SettingsManager.Save(_config);
            
            Log("🛑 Desvinculado. Configuración borrada.");
            
            SetupPanel.Visibility = Visibility.Collapsed;
            WelcomePanel.Visibility = Visibility.Visible;
            txtTokenBox.Password = "";
        }

        private void Log(string msg)
        {
            Dispatcher.Invoke(() =>
            {
                string time = DateTime.Now.ToString("HH:mm:ss");
                txtLogs.AppendText($"[{time}] {msg}\n");
                txtLogs.ScrollToEnd();
                lblStatus.Text = msg; // Keep status updated
            });
        }

        private void BtnHide_Click(object sender, RoutedEventArgs e)
        {
            Hide();
            _notifyIcon.ShowBalloonTip(3000, "Conexion Impresora", "La aplicación sigue ejecutándose en segundo plano.", WinForms.ToolTipIcon.Info);
        }
        
        private void BtnChangePrinter_Click(object sender, RoutedEventArgs e)
        {
             // Stop Service but keep config
             if (_wsService != null) _wsService.Stop();
             
             // Switch to Setup Panel directly
             WelcomePanel.Visibility = Visibility.Collapsed;
             SetupPanel.Visibility = Visibility.Visible;
        }

        private void BtnRegister_Click(object sender, RoutedEventArgs e)
        {
            RegisterProtocol(true);
        }

        private void RegisterProtocol(bool notify = true)
        {
            try
            {
                string exePath = Process.GetCurrentProcess().MainModule.FileName; 
                // Only register if running as EXE (not debug dll sometimes)
                if (!exePath.EndsWith(".exe")) return;

                using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\miinventariofacil"))
                {
                    key.SetValue("", "URL:Miinventariofacil Protocol");
                    key.SetValue("URL Protocol", "");

                    using (var commandKey = key.CreateSubKey(@"shell\open\command"))
                    {
                        commandKey.SetValue("", $"\"{exePath}\" \"%1\"");
                    }
                }

                if (notify) System.Windows.MessageBox.Show("¡Enlace mágico reparado exitosamente!", "Miinventariofacil", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                if (notify) System.Windows.MessageBox.Show($"No se pudo registrar el enlace: {ex.Message}", "Error");
            }
        }
    }
}