using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Customers;
using System.Collections.ObjectModel;

namespace InvensoftDesktop.ViewModels;

public partial class CustomersViewModel : ViewModelBase
{
    private readonly ApiService _api;

    // ─── Lista ───────────────────────────────────────────────────────────────
    [ObservableProperty] private ObservableCollection<Customer> _customers = new();
    [ObservableProperty] private string _searchText = "";
    [ObservableProperty] private bool _isLoading = false;
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private int _totalCount = 0;
    [ObservableProperty] private int _currentPage = 1;

    public bool HasMore => Customers.Count < TotalCount;

    // ─── Panel de nuevo cliente ───────────────────────────────────────────────
    [ObservableProperty] private bool _showAddPanel = false;
    [ObservableProperty] private bool _isSaving = false;

    // Campos del formulario
    [ObservableProperty] private string _newName = "";
    [ObservableProperty] private string _newIdNumber = "";
    [ObservableProperty] private string _newPhone = "";
    [ObservableProperty] private string _newEmail = "";
    [ObservableProperty] private string _newAddress = "";
    [ObservableProperty] private string _newCreditLimit = "100";
    [ObservableProperty] private string _newPaymentTermDays = "15";

    private const int PageSize = 40;

    public CustomersViewModel(ApiService api)
    {
        _api = api;
    }

    // ─── Carga / búsqueda ────────────────────────────────────────────────────

    [RelayCommand]
    public async Task LoadAsync()
    {
        CurrentPage = 1;
        IsLoading = true;
        ErrorMessage = "";
        try
        {
            var result = await _api.GetAsync<CustomerListResponse>(BuildQuery(1));
            Customers.Clear();
            if (result != null)
            {
                TotalCount = result.Total;
                foreach (var c in result.Items) Customers.Add(c);
            }
            OnPropertyChanged(nameof(HasMore));
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch (Exception ex) { ErrorMessage = $"Error al cargar clientes: {ex.Message}"; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task LoadMoreAsync()
    {
        if (!HasMore || IsLoading) return;
        IsLoading = true;
        try
        {
            CurrentPage++;
            var result = await _api.GetAsync<CustomerListResponse>(BuildQuery(CurrentPage));
            if (result != null)
                foreach (var c in result.Items) Customers.Add(c);
            OnPropertyChanged(nameof(HasMore));
        }
        catch (Exception ex) { ErrorMessage = $"Error al cargar más: {ex.Message}"; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task SearchAsync() => await LoadAsync();

    private string BuildQuery(int page)
    {
        var skip = (page - 1) * PageSize;
        // Backend espera el parámetro "q" (no "search")
        var url = $"customers/?skip={skip}&limit={PageSize}";
        if (!string.IsNullOrWhiteSpace(SearchText))
            url += $"&q={Uri.EscapeDataString(SearchText)}";
        return url;
    }

    // ─── Panel agregar cliente ────────────────────────────────────────────────

    [RelayCommand]
    private void OpenAddPanel()
    {
        NewName = "";
        NewIdNumber = "";
        NewPhone = "";
        NewEmail = "";
        NewAddress = "";
        NewCreditLimit = "100";
        NewPaymentTermDays = "15";
        ErrorMessage = "";
        ShowAddPanel = true;
    }

    [RelayCommand]
    private void CancelAdd()
    {
        ShowAddPanel = false;
        ErrorMessage = "";
    }

    [RelayCommand]
    private async Task SaveCustomerAsync()
    {
        if (string.IsNullOrWhiteSpace(NewName))
        {
            ErrorMessage = "El nombre del cliente es obligatorio.";
            return;
        }

        if (!decimal.TryParse(NewCreditLimit.Replace(',', '.'),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture,
                out var creditLimit) || creditLimit < 0)
        {
            ErrorMessage = "Límite de crédito inválido. Use un número positivo (ej: 500).";
            return;
        }

        if (!int.TryParse(NewPaymentTermDays, out var termDays) || termDays < 0)
        {
            ErrorMessage = "Días de crédito inválidos. Use un número entero positivo.";
            return;
        }

        IsSaving = true;
        ErrorMessage = "";
        try
        {
            var dto = new CustomerCreate
            {
                Name             = NewName.Trim(),
                IdNumber         = string.IsNullOrWhiteSpace(NewIdNumber)  ? null : NewIdNumber.Trim(),
                Phone            = string.IsNullOrWhiteSpace(NewPhone)     ? null : NewPhone.Trim(),
                Email            = string.IsNullOrWhiteSpace(NewEmail)     ? null : NewEmail.Trim(),
                Address          = string.IsNullOrWhiteSpace(NewAddress)   ? null : NewAddress.Trim(),
                CreditLimit      = creditLimit,
                PaymentTermDays  = termDays,
                IsBlocked        = false,
                IsActive         = true
            };

            var created = await _api.PostAsync<CustomerCreate, Customer>("customers", dto);
            if (created != null)
            {
                // Insertar al inicio de la lista
                Customers.Insert(0, created);
                TotalCount++;
                OnPropertyChanged(nameof(HasMore));
                ShowAddPanel = false;
            }
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch (HttpRequestException ex) when (ex.Message.Contains("400"))
        {
            ErrorMessage = "El RIF/CI ya existe en el sistema.";
        }
        catch (Exception ex) { ErrorMessage = $"Error al guardar: {ex.Message}"; }
        finally { IsSaving = false; }
    }
}
