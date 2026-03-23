using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Inventory;
using System.Collections.ObjectModel;
using System.Text.Json.Serialization;

namespace InvensoftDesktop.ViewModels;

/// <summary>
/// Cuerpo para POST /api/v1/inventory/add y /api/v1/inventory/remove.
/// warehouse_id es requerido por el backend (StockAdjustmentCreate).
/// </summary>
public class StockAdjustmentRequest
{
    [JsonPropertyName("product_id")]   public int ProductId { get; set; }
    [JsonPropertyName("warehouse_id")] public int WarehouseId { get; set; } = 1;
    [JsonPropertyName("type")]         public string Type { get; set; } = "ADJUSTMENT_IN";
    [JsonPropertyName("quantity")]     public decimal Quantity { get; set; }
    [JsonPropertyName("reason")]       public string Reason { get; set; } = "";
}

public partial class InventoryViewModel : ViewModelBase
{
    private readonly ApiService _api;

    // ── Kardex ───────────────────────────────────────────────────────────
    // El endpoint GET /api/v1/inventory/kardex retorna List<KardexRead> (lista plana).
    // Parámetros soportados: product_id, start_date, end_date, limit (sin skip/paginación).
    [ObservableProperty] private ObservableCollection<KardexEntry> _kardex = new();
    [ObservableProperty] private string _productIdFilter = "";
    [ObservableProperty] private bool _isLoadingKardex = false;
    [ObservableProperty] private int _kardexCount = 0;

    // ── Ajuste ───────────────────────────────────────────────────────────
    [ObservableProperty] private string _adjProductId = "";
    [ObservableProperty] private string _adjQuantity = "";
    [ObservableProperty] private string _adjReason = "";
    [ObservableProperty] private string _adjType = "ADJUSTMENT_IN";
    [ObservableProperty] private bool _isAdjIn = true;
    [ObservableProperty] private bool _isProcessing = false;

    public string AdjInBg  => IsAdjIn ? "#059669" : "#F1F5F9";
    public string AdjInFg  => IsAdjIn ? "White"   : "#64748B";
    public string AdjOutBg => !IsAdjIn ? "#DC2626" : "#F1F5F9";
    public string AdjOutFg => !IsAdjIn ? "White"   : "#64748B";

    // ── Estado ───────────────────────────────────────────────────────────
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private string _successMessage = "";

    public bool HasKardex => Kardex.Count > 0;

    private const int DefaultLimit = 200;

    public InventoryViewModel(ApiService api)
    {
        _api = api;
    }

    [RelayCommand]
    public async Task LoadAsync() => await LoadKardexAsync();

    [RelayCommand]
    public async Task LoadKardexAsync()
    {
        IsLoadingKardex = true;
        ErrorMessage = "";
        try
        {
            var result = await _api.GetAsync<List<KardexEntry>>(BuildKardexQuery());
            Kardex.Clear();
            if (result != null)
            {
                foreach (var k in result) Kardex.Add(k);
            }
            KardexCount = Kardex.Count;
            OnPropertyChanged(nameof(HasKardex));
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch (Exception ex) { ErrorMessage = $"Error al cargar kardex: {ex.Message}"; }
        finally { IsLoadingKardex = false; }
    }

    [RelayCommand]
    private void SetAdjIn()
    {
        IsAdjIn = true;
        AdjType = "ADJUSTMENT_IN";
        OnPropertyChanged(nameof(AdjInBg));  OnPropertyChanged(nameof(AdjInFg));
        OnPropertyChanged(nameof(AdjOutBg)); OnPropertyChanged(nameof(AdjOutFg));
    }

    [RelayCommand]
    private void SetAdjOut()
    {
        IsAdjIn = false;
        AdjType = "ADJUSTMENT_OUT";
        OnPropertyChanged(nameof(AdjInBg));  OnPropertyChanged(nameof(AdjInFg));
        OnPropertyChanged(nameof(AdjOutBg)); OnPropertyChanged(nameof(AdjOutFg));
    }

    [RelayCommand]
    private async Task ConfirmAdjustmentAsync()
    {
        if (!int.TryParse(AdjProductId, out var productId) || productId <= 0)
        { ErrorMessage = "Ingresa un ID de producto válido."; return; }
        if (!decimal.TryParse(AdjQuantity, System.Globalization.NumberStyles.Any,
                              System.Globalization.CultureInfo.InvariantCulture, out var qty) || qty <= 0)
        { ErrorMessage = "Ingresa una cantidad válida (mayor a 0)."; return; }

        IsProcessing = true;
        ErrorMessage = "";
        SuccessMessage = "";
        try
        {
            var endpoint = IsAdjIn ? "inventory/add" : "inventory/remove";
            var req = new StockAdjustmentRequest
            {
                ProductId   = productId,
                WarehouseId = 1,   // almacén predeterminado; requerido por backend
                Type        = AdjType,
                Quantity    = qty,
                Reason      = string.IsNullOrWhiteSpace(AdjReason) ? "Ajuste manual" : AdjReason
            };
            await _api.PostAsync<StockAdjustmentRequest, object>(endpoint, req);

            SuccessMessage = $"Ajuste registrado: {(IsAdjIn ? "+" : "-")}{qty:0.##} unidades — producto #{productId}";
            AdjProductId = "";
            AdjQuantity  = "";
            AdjReason    = "";

            // Refrescar kardex filtrado al mismo producto para feedback inmediato
            ProductIdFilter = productId.ToString();
            await LoadKardexAsync();
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch (HttpRequestException ex)     { ErrorMessage = $"Error del servidor: {ex.Message}"; }
        catch                               { ErrorMessage = "Error al registrar el ajuste."; }
        finally { IsProcessing = false; }
    }

    private string BuildKardexQuery()
    {
        var q = $"inventory/kardex?limit={DefaultLimit}";
        if (!string.IsNullOrWhiteSpace(ProductIdFilter) && int.TryParse(ProductIdFilter, out var pid))
            q += $"&product_id={pid}";
        return q;
    }
}
