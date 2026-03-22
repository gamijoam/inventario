using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models;

namespace InvensoftDesktop.ViewModels;

public partial class LoginViewModel : ViewModelBase
{
    private readonly AuthService _auth;
    private readonly SettingsManager _settings;
    private readonly BackendLauncher _launcher;

    // ── Modo ──────────────────────────────────────────────────────────────
    [ObservableProperty] private bool _isLocalMode;
    [ObservableProperty] private bool _isCloudMode = true;

    // Colores del selector de modo (computed desde IsCloudMode/IsLocalMode)
    public string CloudButtonBg => IsCloudMode ? "#4F46E5" : "Transparent";
    public string LocalButtonBg => IsLocalMode ? "#4F46E5" : "Transparent";
    public string CloudButtonFg => IsCloudMode ? "White" : "#64748B";
    public string LocalButtonFg => IsLocalMode ? "White" : "#64748B";

    // ── Campos Cloud ──────────────────────────────────────────────────────
    [ObservableProperty] private string _serverUrl = "https://api.miinventariofacil.com";
    [ObservableProperty] private string _tenantSlug = "";

    // ── Campos comunes ────────────────────────────────────────────────────
    [ObservableProperty] private string _username = "";
    [ObservableProperty] private string _password = "";

    // ── Estado UI ─────────────────────────────────────────────────────────
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private string _statusMessage = "";
    [ObservableProperty] private bool _isLoading = false;

    public event Action? LoginSucceeded;

    public LoginViewModel(AuthService auth, SettingsManager settings, BackendLauncher launcher)
    {
        _auth = auth;
        _settings = settings;
        _launcher = launcher;

        // Pre-fill desde configuración guardada
        var s = settings.Settings;
        IsLocalMode = s.IsLocalMode;
        IsCloudMode = s.IsCloudMode;
        ServerUrl   = s.ServerUrl;
        TenantSlug  = s.TenantSlug;
        Username    = s.SavedUsername;
    }

    [RelayCommand]
    private void SwitchToCloud()
    {
        IsLocalMode = false;
        IsCloudMode = true;
        ErrorMessage = "";
        StatusMessage = "";
        OnPropertyChanged(nameof(CloudButtonBg));
        OnPropertyChanged(nameof(LocalButtonBg));
        OnPropertyChanged(nameof(CloudButtonFg));
        OnPropertyChanged(nameof(LocalButtonFg));
    }

    [RelayCommand]
    private void SwitchToLocal()
    {
        IsLocalMode = true;
        IsCloudMode = false;
        ErrorMessage = "";
        StatusMessage = "";
        OnPropertyChanged(nameof(CloudButtonBg));
        OnPropertyChanged(nameof(LocalButtonBg));
        OnPropertyChanged(nameof(CloudButtonFg));
        OnPropertyChanged(nameof(LocalButtonFg));
    }

    [RelayCommand]
    private async Task LoginAsync()
    {
        if (string.IsNullOrWhiteSpace(Username)) { ErrorMessage = "Ingresa tu usuario."; return; }
        if (string.IsNullOrWhiteSpace(Password)) { ErrorMessage = "Ingresa tu contraseña."; return; }
        if (IsCloudMode && string.IsNullOrWhiteSpace(TenantSlug))
        {
            ErrorMessage = "Ingresa el nombre de la empresa."; return;
        }

        IsLoading = true;
        ErrorMessage = "";
        StatusMessage = "";

        // En modo local: levantar backend si no está corriendo
        if (IsLocalMode)
        {
            _settings.Settings.Mode = AppMode.Local;
            var progress = new Progress<string>(msg => StatusMessage = msg);
            var (ok, error) = await _launcher.StartAsync(progress);
            if (!ok)
            {
                IsLoading = false;
                ErrorMessage = error;
                return;
            }
            StatusMessage = "Servidor listo. Iniciando sesión…";
        }
        else
        {
            _settings.Settings.Mode = AppMode.Cloud;
        }

        var server = IsLocalMode
            ? _settings.Settings.EffectiveServerUrl
            : ServerUrl;
        var tenant = IsLocalMode
            ? _settings.Settings.EffectiveTenantSlug
            : TenantSlug;

        var (loginOk, loginError) = await _auth.LoginAsync(server, tenant, Username, Password);

        IsLoading = false;
        StatusMessage = "";

        if (loginOk)
            LoginSucceeded?.Invoke();
        else
            ErrorMessage = loginError;
    }
}
