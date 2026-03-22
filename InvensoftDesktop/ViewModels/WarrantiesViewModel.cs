using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Warranties;
using System.Collections.ObjectModel;

namespace InvensoftDesktop.ViewModels;

public partial class WarrantiesViewModel : ViewModelBase
{
    private readonly ApiService _api;

    [ObservableProperty] private ObservableCollection<WarrantyPolicy> _policies = new();
    [ObservableProperty] private ObservableCollection<WarrantyClaim> _claims = new();
    [ObservableProperty] private bool _isLoading = false;
    [ObservableProperty] private string _errorMessage = "";

    public WarrantiesViewModel(ApiService api)
    {
        _api = api;
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        IsLoading = true;
        ErrorMessage = "";
        try
        {
            var policies = await _api.GetAsync<List<WarrantyPolicy>>("warranties/policies");
            Policies.Clear();
            if (policies != null)
                foreach (var p in policies) Policies.Add(p);

            var claims = await _api.GetAsync<List<WarrantyClaim>>("warranties/claims?skip=0&limit=50");
            Claims.Clear();
            if (claims != null)
                foreach (var c in claims) Claims.Add(c);
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch { ErrorMessage = "No se pudo cargar garantías."; }
        finally { IsLoading = false; }
    }
}
