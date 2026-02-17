using System;
using System.Windows;
using Invensoft_Windows_Bridge.Services;

namespace Invensoft_Windows_Bridge
{
    public partial class MainWindow : Window
    {
        private AppConfig _config;
        private WebSocketService _wsService;

        public MainWindow()
        {
            InitializeComponent();
            LoadConfig();
        }

        private void LoadConfig()
        {
            _config = SettingsManager.Load();
            
            if (SettingsManager.IsConfigured())
            {
                ShowStatus();
                StartBridge();
            }
            else
            {
                // Show Setup
                txtTenantId.Text = _config.TenantId;
                txtClientId.Text = _config.ClientId;
                txtHost.Text = _config.Host;
                txtPrinter.Text = _config.PrinterName;
                chkVirtualMode.IsChecked = _config.PrinterMode == "VIRTUAL";
            }
        }

        private void StartBridge()
        {
            if (_wsService != null)
            {
                _wsService.Stop();
            }

            _wsService = new WebSocketService(_config);
            _wsService.OnStatusChanged += (msg) =>
            {
                Dispatcher.Invoke(() => 
                {
                    lblStatus.Text = msg;
                });
            };

            // Start in background
            _ = _wsService.StartAsync();
        }

        private void BtnSave_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(txtTenantId.Text) || string.IsNullOrWhiteSpace(txtToken.Text) || string.IsNullOrWhiteSpace(txtHost.Text))
            {
                MessageBox.Show("Por favor complete todos los campos requeridos.", "Error", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            _config.TenantId = txtTenantId.Text.Trim();
            _config.ClientId = txtClientId.Text.Trim();
            _config.Host = txtHost.Text.Trim();
            _config.AuthToken = txtToken.Text.Trim();
            _config.PrinterName = txtPrinter.Text.Trim();
            _config.PrinterMode = (chkVirtualMode.IsChecked == true) ? "VIRTUAL" : "WINDOWS";

            SettingsManager.Save(_config);
            ShowStatus();
            StartBridge();
            
            MessageBox.Show("Configuración Guardada. El servicio iniciará en segundo plano.", "Éxito");
        }

        private void BtnUnlink_Click(object sender, RoutedEventArgs e)
        {
            if (_wsService != null) _wsService.Stop();

            _config.AuthToken = "";
            SettingsManager.Save(_config);
            
            StatusPanel.Visibility = Visibility.Collapsed;
            SetupPanel.Visibility = Visibility.Visible;
            txtToken.Clear();
        }

        private void BtnHide_Click(object sender, RoutedEventArgs e)
        {
            this.WindowState = WindowState.Minimized;
        }

        private void ShowStatus()
        {
            SetupPanel.Visibility = Visibility.Collapsed;
            StatusPanel.Visibility = Visibility.Visible;
            lblStatus.Text = $"Conectado como: {_config.ClientId}\nModo: {_config.PrinterMode}\nIniciando...";
        }
    }
}