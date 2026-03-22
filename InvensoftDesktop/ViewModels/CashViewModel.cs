using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Cash;

namespace InvensoftDesktop.ViewModels;

public partial class CashViewModel : ViewModelBase
{
    private readonly ApiService _api;

    [ObservableProperty] private CashSession? _currentSession;
    [ObservableProperty] private bool _isLoading = false;
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private string _successMessage = "";
    [ObservableProperty] private string _openingAmountText = "0.00";

    public bool IsOpen => CurrentSession?.IsOpen == true;
    public bool IsClosed => !IsOpen;

    public CashViewModel(ApiService api)
    {
        _api = api;
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        IsLoading = true;
        ErrorMessage = "";
        SuccessMessage = "";
        try
        {
            CurrentSession = await _api.GetAsync<CashSession>("cash/sessions/current");
            OnPropertyChanged(nameof(IsOpen));
            OnPropertyChanged(nameof(IsClosed));
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch { CurrentSession = null; OnPropertyChanged(nameof(IsOpen)); OnPropertyChanged(nameof(IsClosed)); }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task OpenSessionAsync()
    {
        if (!decimal.TryParse(OpeningAmountText, out var amount))
        {
            ErrorMessage = "Ingresa un monto válido.";
            return;
        }

        IsLoading = true;
        ErrorMessage = "";
        SuccessMessage = "";
        try
        {
            var req = new OpenSessionRequest { OpeningAmount = amount };
            var session = await _api.PostAsync<OpenSessionRequest, CashSession>("cash/sessions/open", req);
            if (session != null)
            {
                CurrentSession = session;
                SuccessMessage = $"Caja abierta con ${amount:F2}";
                OnPropertyChanged(nameof(IsOpen));
                OnPropertyChanged(nameof(IsClosed));
            }
            else
            {
                ErrorMessage = "No se pudo abrir la caja.";
            }
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch { ErrorMessage = "Error al abrir la caja."; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task CloseSessionAsync()
    {
        if (CurrentSession == null) return;

        IsLoading = true;
        ErrorMessage = "";
        SuccessMessage = "";
        try
        {
            var result = await _api.PostAsync<object, CashSession>(
                $"cash/sessions/{CurrentSession.Id}/close", new { });
            if (result != null)
            {
                CurrentSession = null;
                SuccessMessage = "Caja cerrada correctamente.";
                OnPropertyChanged(nameof(IsOpen));
                OnPropertyChanged(nameof(IsClosed));
            }
            else
            {
                ErrorMessage = "No se pudo cerrar la caja.";
            }
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch { ErrorMessage = "Error al cerrar la caja."; }
        finally { IsLoading = false; }
    }
}
