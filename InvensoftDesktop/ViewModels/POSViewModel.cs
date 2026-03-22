using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Products;
using System.Collections.ObjectModel;
using System.Text.Json.Serialization;

namespace InvensoftDesktop.ViewModels;

public class CartItem
{
    public int ProductId { get; set; }
    public string Name { get; set; } = "";
    public decimal UnitPrice { get; set; }
    public decimal Quantity { get; set; }
    public decimal Subtotal => UnitPrice * Quantity;
    public string SubtotalDisplay => $"${Subtotal:F2}";
    public string PriceDisplay => $"${UnitPrice:F2}";
}

public class SalePayment
{
    [JsonPropertyName("amount")]        public decimal Amount { get; set; }
    [JsonPropertyName("currency")]      public string Currency { get; set; } = "USD";
    [JsonPropertyName("payment_method")] public string PaymentMethod { get; set; } = "Efectivo";
    [JsonPropertyName("exchange_rate")] public decimal ExchangeRate { get; set; } = 1;
}

public class SaleRequest
{
    [JsonPropertyName("total_amount")]    public decimal TotalAmount { get; set; }
    [JsonPropertyName("total_amount_bs")] public decimal TotalAmountBs { get; set; }
    [JsonPropertyName("currency")]        public string Currency { get; set; } = "USD";
    [JsonPropertyName("exchange_rate")]   public decimal ExchangeRate { get; set; } = 1;
    [JsonPropertyName("payment_method")]  public string PaymentMethod { get; set; } = "Efectivo";
    [JsonPropertyName("payments")]        public List<SalePayment> Payments { get; set; } = new();
    [JsonPropertyName("items")]           public List<SaleItem> Items { get; set; } = new();
    [JsonPropertyName("session_id")]      public int? SessionId { get; set; }
    [JsonPropertyName("warehouse_id")]    public int? WarehouseId { get; set; }
    [JsonPropertyName("is_credit")]       public bool IsCredit { get; set; } = false;
}

public class SaleItem
{
    [JsonPropertyName("product_id")]  public int ProductId { get; set; }
    [JsonPropertyName("quantity")]    public decimal Quantity { get; set; }
    [JsonPropertyName("unit_price")]  public decimal UnitPrice { get; set; }
    [JsonPropertyName("subtotal")]    public decimal Subtotal { get; set; }
}

public partial class POSViewModel : ViewModelBase
{
    private readonly ApiService _api;

    // ── Búsqueda ──────────────────────────────────────────────────────────
    [ObservableProperty] private string _searchText = "";
    [ObservableProperty] private Product? _foundProduct;
    [ObservableProperty] private bool _isSearching = false;
    [ObservableProperty] private string _searchError = "";

    // ── Carrito ───────────────────────────────────────────────────────────
    [ObservableProperty] private ObservableCollection<CartItem> _cart = new();
    [ObservableProperty] private decimal _totalUSD = 0;

    // ── Cobro ─────────────────────────────────────────────────────────────
    [ObservableProperty] private bool _isPaymentOpen = false;
    [ObservableProperty] private string _paidAmountText = "";
    [ObservableProperty] private string _changeDisplay = "";

    // ── Estado general ────────────────────────────────────────────────────
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private string _successMessage = "";
    [ObservableProperty] private bool _isProcessing = false;

    public bool CartHasItems => Cart.Count > 0;

    public POSViewModel(ApiService api)
    {
        _api = api;
        Cart.CollectionChanged += (_, _) => OnPropertyChanged(nameof(CartHasItems));
    }

    // ── Buscar producto ───────────────────────────────────────────────────
    [RelayCommand]
    private async Task SearchProductAsync()
    {
        if (string.IsNullOrWhiteSpace(SearchText)) return;

        IsSearching = true;
        SearchError = "";
        FoundProduct = null;

        try
        {
            var result = await _api.GetAsync<Product>(
                $"products/lookup?q={Uri.EscapeDataString(SearchText.Trim())}");
            if (result != null)
            {
                FoundProduct = result;
                // Si es código de barras (sin espacios), agregar automáticamente
                if (!SearchText.Contains(' '))
                    AddFoundProductToCart();
            }
            else
            {
                SearchError = $"No se encontró: {SearchText}";
            }
        }
        catch { SearchError = "Error al buscar el producto."; }
        finally { IsSearching = false; }
    }

    [RelayCommand]
    private void AddFoundProductToCart()
    {
        if (FoundProduct == null) return;

        var existing = Cart.FirstOrDefault(c => c.ProductId == FoundProduct.Id);
        if (existing != null)
        {
            // Incrementar cantidad
            var idx = Cart.IndexOf(existing);
            Cart[idx] = new CartItem
            {
                ProductId = existing.ProductId,
                Name = existing.Name,
                UnitPrice = existing.UnitPrice,
                Quantity = existing.Quantity + 1
            };
        }
        else
        {
            Cart.Add(new CartItem
            {
                ProductId = FoundProduct.Id,
                Name = FoundProduct.Name,
                UnitPrice = FoundProduct.Price,
                Quantity = 1
            });
        }

        RecalculateTotal();
        SearchText = "";
        FoundProduct = null;
        SearchError = "";
    }

    [RelayCommand]
    private void RemoveFromCart(CartItem item)
    {
        Cart.Remove(item);
        RecalculateTotal();
    }

    [RelayCommand]
    private void ClearCart()
    {
        Cart.Clear();
        RecalculateTotal();
        SuccessMessage = "";
        ErrorMessage = "";
    }

    private void RecalculateTotal()
    {
        TotalUSD = Cart.Sum(c => c.Subtotal);
        OnPropertyChanged(nameof(CartHasItems));
    }

    // ── Modal de cobro ────────────────────────────────────────────────────
    [RelayCommand]
    private void OpenPayment()
    {
        if (!CartHasItems) return;
        PaidAmountText = TotalUSD.ToString("F2");
        ChangeDisplay = "$0.00";
        IsPaymentOpen = true;
        ErrorMessage = "";
    }

    [RelayCommand]
    private void ClosePayment() => IsPaymentOpen = false;

    partial void OnPaidAmountTextChanged(string value)
    {
        if (decimal.TryParse(value, out var paid))
        {
            var change = paid - TotalUSD;
            ChangeDisplay = change >= 0 ? $"${change:F2}" : "Monto insuficiente";
        }
        else ChangeDisplay = "";
    }

    [RelayCommand]
    private async Task ConfirmSaleAsync()
    {
        if (!decimal.TryParse(PaidAmountText, out var paid) || paid < TotalUSD)
        {
            ErrorMessage = "El monto pagado es insuficiente.";
            return;
        }

        IsProcessing = true;
        ErrorMessage = "";

        try
        {
            var request = new SaleRequest
            {
                TotalAmount = TotalUSD,
                Currency = "USD",
                ExchangeRate = 1,
                PaymentMethod = "Efectivo",
                Payments = new List<SalePayment>
                {
                    new() { Amount = paid, Currency = "USD",
                            PaymentMethod = "Efectivo", ExchangeRate = 1 }
                },
                Items = Cart.Select(c => new SaleItem
                {
                    ProductId = c.ProductId,
                    Quantity = c.Quantity,
                    UnitPrice = c.UnitPrice,
                    Subtotal = c.Subtotal
                }).ToList()
            };

            var result = await _api.PostAsync<SaleRequest, object>("products/sales/", request);

            IsPaymentOpen = false;
            ClearCart();
            SuccessMessage = $"Venta registrada: ${TotalUSD:F2}";
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch { ErrorMessage = "Error al procesar la venta."; }
        finally { IsProcessing = false; }
    }
}
