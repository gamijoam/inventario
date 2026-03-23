using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Products;
using System.Collections.ObjectModel;

namespace InvensoftDesktop.ViewModels;

public partial class ProductsViewModel : ViewModelBase
{
    private readonly ApiService _api;

    // ── Lista ──────────────────────────────────────────────────────────
    [ObservableProperty] private ObservableCollection<Product> _products = new();
    [ObservableProperty] private string _searchText = "";
    [ObservableProperty] private bool _isLoading = false;
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private int _totalCount = 0;
    [ObservableProperty] private int _currentPage = 1;

    private const int PageSize = 40;

    public bool HasMore => Products.Count < TotalCount;

    // ── Formulario "Agregar Producto" ──────────────────────────────────
    [ObservableProperty] private bool _showAddForm = false;

    // Campos del formulario
    [ObservableProperty] private string _formName = "";
    [ObservableProperty] private string _formSku = "";
    [ObservableProperty] private string _formPrice = "";
    [ObservableProperty] private string _formStock = "";
    [ObservableProperty] private string _formCostPrice = "";
    [ObservableProperty] private string _formDescription = "";
    [ObservableProperty] private string _formMinStock = "5";
    [ObservableProperty] private bool _formIsService = false;
    [ObservableProperty] private string _formErrorMessage = "";
    [ObservableProperty] private bool _isSaving = false;

    public ProductsViewModel(ApiService api)
    {
        _api = api;
    }

    // ── Comandos de lista ──────────────────────────────────────────────

    [RelayCommand]
    public async Task LoadAsync()
    {
        _lastSearch = SearchText;
        CurrentPage = 1;
        IsLoading = true;
        ErrorMessage = "";

        try
        {
            var query = BuildQuery(1);
            var result = await _api.GetAsync<ProductListResponse>(query);
            Products.Clear();
            if (result != null)
            {
                TotalCount = result.Total;
                foreach (var p in result.Items) Products.Add(p);
            }
            OnPropertyChanged(nameof(HasMore));
        }
        catch (UnauthorizedAccessException)
        {
            ErrorMessage = "Sesión expirada. Por favor inicie sesión nuevamente.";
        }
        catch (Exception ex)
        {
            ErrorMessage = $"No se pudo cargar los productos: {ex.Message}";
        }
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
            var result = await _api.GetAsync<ProductListResponse>(BuildQuery(CurrentPage));
            if (result != null)
                foreach (var p in result.Items) Products.Add(p);
            OnPropertyChanged(nameof(HasMore));
        }
        catch (Exception ex)
        {
            ErrorMessage = $"Error al cargar más productos: {ex.Message}";
        }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task SearchAsync() => await LoadAsync();

    // ── Comandos del formulario ────────────────────────────────────────

    [RelayCommand]
    private void OpenAddForm()
    {
        // Limpiar formulario
        FormName = "";
        FormSku = "";
        FormPrice = "";
        FormStock = "0";
        FormCostPrice = "0";
        FormDescription = "";
        FormMinStock = "5";
        FormIsService = false;
        FormErrorMessage = "";
        ShowAddForm = true;
    }

    [RelayCommand]
    private void CloseAddForm()
    {
        ShowAddForm = false;
        FormErrorMessage = "";
    }

    [RelayCommand]
    private async Task SaveProductAsync()
    {
        FormErrorMessage = "";

        // Validación básica
        if (string.IsNullOrWhiteSpace(FormName))
        {
            FormErrorMessage = "El nombre del producto es obligatorio.";
            return;
        }

        if (!decimal.TryParse(FormPrice.Replace(',', '.'),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture,
                out var price) || price < 0)
        {
            FormErrorMessage = "Precio inválido. Ingrese un número mayor o igual a 0.";
            return;
        }

        if (!decimal.TryParse(FormStock.Replace(',', '.'),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture,
                out var stock))
            stock = 0;

        if (!decimal.TryParse(FormCostPrice.Replace(',', '.'),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture,
                out var costPrice))
            costPrice = 0;

        if (!decimal.TryParse(FormMinStock.Replace(',', '.'),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture,
                out var minStock))
            minStock = 5;

        IsSaving = true;
        try
        {
            var payload = new ProductCreateRequest
            {
                Name        = FormName.Trim(),
                Sku         = string.IsNullOrWhiteSpace(FormSku) ? null : FormSku.Trim(),
                Price       = price,
                Stock       = stock,
                CostPrice   = costPrice,
                Description = string.IsNullOrWhiteSpace(FormDescription) ? null : FormDescription.Trim(),
                MinStock    = minStock,
                IsService   = FormIsService,
            };

            var created = await _api.PostAsync<ProductCreateRequest, Product>("products/", payload);
            if (created != null)
            {
                // Insertar al inicio de la lista local
                Products.Insert(0, created);
                TotalCount++;
                OnPropertyChanged(nameof(HasMore));
                ShowAddForm = false;
            }
        }
        catch (UnauthorizedAccessException)
        {
            FormErrorMessage = "Sesión expirada. Por favor inicie sesión nuevamente.";
        }
        catch (Exception ex)
        {
            FormErrorMessage = $"Error al guardar: {ex.Message}";
        }
        finally { IsSaving = false; }
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private string _lastSearch = "";

    private string BuildQuery(int page)
    {
        var skip = (page - 1) * PageSize;
        var q = $"products/catalog?skip={skip}&limit={PageSize}";
        if (!string.IsNullOrWhiteSpace(SearchText))
            q += $"&search={Uri.EscapeDataString(SearchText)}";
        return q;
    }
}
