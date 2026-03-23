using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;

namespace InvensoftDesktop.ViewModels;

public partial class LoginViewModel : ViewModelBase
{
    private readonly AuthService     _auth;
    private readonly SettingsManager _settings;

    [ObservableProperty] private string _serverUrl  = "http://localhost:8000";
    [ObservableProperty] private string _tenantSlug = "";
    [ObservableProperty] private string _username   = "";
    [ObservableProperty] private string _password   = "";
    [ObservableProperty] private string _errorMessage  = "";
    [ObservableProperty] private string _statusMessage = "";
    [ObservableProperty] private bool   _isLoading  = false;

    public event Action? LoginSucceeded;

    public LoginViewModel(AuthService auth, SettingsManager settings)
    {
        _auth     = auth;
        _settings = settings;

        var s    = settings.Settings;
        ServerUrl  = s.ServerUrl;
        TenantSlug = s.TenantSlug;
        Username   = s.SavedUsername;
    }

    [RelayCommand]
    private async Task LoginAsync()
    {
        if (string.IsNullOrWhiteSpace(ServerUrl))   { ErrorMessage = "Ingresa la URL del servidor."; return; }
        if (string.IsNullOrWhiteSpace(TenantSlug))  { ErrorMessage = "Ingresa el nombre del tenant."; return; }
        if (string.IsNullOrWhiteSpace(Username))    { ErrorMessage = "Ingresa tu usuario."; return; }
        if (string.IsNullOrWhiteSpace(Password))    { ErrorMessage = "Ingresa tu contraseña."; return; }

        IsLoading    = true;
        ErrorMessage = "";

        var (ok, error) = await _auth.LoginAsync(ServerUrl, TenantSlug, Username, Password);

        IsLoading = false;

        if (ok)
            LoginSucceeded?.Invoke();
        else
            ErrorMessage = error;
    }
}
