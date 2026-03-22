using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;

namespace InvensoftDesktop.ViewModels;

public partial class LoginViewModel : ViewModelBase
{
    private readonly AuthService _auth;
    private readonly SettingsManager _settings;

    [ObservableProperty] private string _serverUrl = "https://api.miinventariofacil.com";
    [ObservableProperty] private string _tenantSlug = "";
    [ObservableProperty] private string _username = "";
    [ObservableProperty] private string _password = "";
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private bool _isLoading = false;

    public event Action? LoginSucceeded;

    public LoginViewModel(AuthService auth, SettingsManager settings)
    {
        _auth = auth;
        _settings = settings;

        ServerUrl = settings.Settings.ServerUrl;
        TenantSlug = settings.Settings.TenantSlug;
        Username = settings.Settings.SavedUsername;
    }

    [RelayCommand]
    private async Task LoginAsync()
    {
        if (string.IsNullOrWhiteSpace(TenantSlug))  { ErrorMessage = "Ingresa el nombre de la empresa (tenant)."; return; }
        if (string.IsNullOrWhiteSpace(Username))     { ErrorMessage = "Ingresa tu usuario."; return; }
        if (string.IsNullOrWhiteSpace(Password))     { ErrorMessage = "Ingresa tu contraseña."; return; }

        IsLoading = true;
        ErrorMessage = "";

        var (ok, error) = await _auth.LoginAsync(ServerUrl, TenantSlug, Username, Password);

        IsLoading = false;

        if (ok)
            LoginSucceeded?.Invoke();
        else
            ErrorMessage = error;
    }
}
