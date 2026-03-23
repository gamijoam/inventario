using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Cash;
using System.Collections.ObjectModel;

namespace InvensoftDesktop.ViewModels;

public partial class CashViewModel : ViewModelBase
{
    private readonly ApiService _api;

    [ObservableProperty] private CashSession? _currentSession;
    [ObservableProperty] private bool _isLoading = false;
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private string _successMessage = "";
    [ObservableProperty] private string _openingAmountText = "0.00";
    [ObservableProperty] private string _closingAmountText = "0.00";
    [ObservableProperty] private ObservableCollection<CashMovement> _movements = new();

    public bool IsOpen => CurrentSession?.IsOpen == true;
    public bool IsClosed => !IsOpen;
    public bool HasMovements => Movements.Count > 0;

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
            RefreshMovements();
            OnPropertyChanged(nameof(IsOpen));
            OnPropertyChanged(nameof(IsClosed));
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesion expirada."; }
        catch
        {
            CurrentSession = null;
            Movements.Clear();
            OnPropertyChanged(nameof(IsOpen));
            OnPropertyChanged(nameof(IsClosed));
            OnPropertyChanged(nameof(HasMovements));
        }
        finally { IsLoading = false; }
    }

    private void RefreshMovements()
    {
        Movements.Clear();
        if (CurrentSession?.Movements != null)
        {
            foreach (var m in CurrentSession.Movements.OrderByDescending(x => x.Date))
                Movements.Add(m);
        }
        OnPropertyChanged(nameof(HasMovements));
    }

    [RelayCommand]
    private async Task OpenSessionAsync()
    {
        if (!decimal.TryParse(
                OpeningAmountText.Replace(',', '.'),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture,
                out var amount))
        {
            ErrorMessage = "Ingresa un monto valido.";
            return;
        }

        IsLoading = true;
        ErrorMessage = "";
        SuccessMessage = "";
        try
        {
            var req = new OpenSessionRequest { InitialCash = amount };
            var session = await _api.PostAsync<OpenSessionRequest, CashSession>("cash/sessions/open", req);
            if (session != null)
            {
                CurrentSession = session;
                RefreshMovements();
                SuccessMessage = $"Caja abierta con ${amount:F2}";
                OnPropertyChanged(nameof(IsOpen));
                OnPropertyChanged(nameof(IsClosed));
            }
            else
            {
                ErrorMessage = "No se pudo abrir la caja.";
            }
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesion expirada."; }
        catch (Exception ex) { ErrorMessage = $"Error al abrir la caja: {ex.Message}"; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task CloseSessionAsync()
    {
        if (CurrentSession == null) return;

        if (!decimal.TryParse(
                ClosingAmountText.Replace(',', '.'),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture,
                out var finalAmount))
        {
            ErrorMessage = "Ingresa el monto final valido.";
            return;
        }

        IsLoading = true;
        ErrorMessage = "";
        SuccessMessage = "";
        try
        {
            var req = new CloseSessionRequest { FinalCashReported = finalAmount };
            var result = await _api.PostAsync<CloseSessionRequest, CashSession>(
                $"cash/sessions/{CurrentSession.Id}/close", req);
            if (result != null)
            {
                CurrentSession = null;
                Movements.Clear();
                OnPropertyChanged(nameof(HasMovements));
                SuccessMessage = "Caja cerrada correctamente.";
                OnPropertyChanged(nameof(IsOpen));
                OnPropertyChanged(nameof(IsClosed));
            }
            else
            {
                ErrorMessage = "No se pudo cerrar la caja.";
            }
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesion expirada."; }
        catch (Exception ex) { ErrorMessage = $"Error al cerrar la caja: {ex.Message}"; }
        finally { IsLoading = false; }
    }
}
