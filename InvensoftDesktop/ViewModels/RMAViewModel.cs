using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.RMA;

namespace InvensoftDesktop.ViewModels;

public partial class RMAViewModel : ViewModelBase
{
    private readonly ApiService _api;

    [ObservableProperty] private string _imeiText = "";
    [ObservableProperty] private RMACheckResult? _checkResult;
    [ObservableProperty] private bool _isChecking = false;
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private string _successMessage = "";

    public bool HasResult => CheckResult != null;

    public RMAViewModel(ApiService api)
    {
        _api = api;
    }

    [RelayCommand]
    public Task LoadAsync() { return Task.CompletedTask; }

    [RelayCommand]
    private async Task CheckIMEIAsync()
    {
        if (string.IsNullOrWhiteSpace(ImeiText)) return;

        IsChecking = true;
        ErrorMessage = "";
        SuccessMessage = "";
        CheckResult = null;
        OnPropertyChanged(nameof(HasResult));

        try
        {
            CheckResult = await _api.GetAsync<RMACheckResult>(
                $"rma/check/{Uri.EscapeDataString(ImeiText.Trim())}");
            OnPropertyChanged(nameof(HasResult));
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch { ErrorMessage = "Error al consultar el IMEI."; }
        finally { IsChecking = false; }
    }
}
