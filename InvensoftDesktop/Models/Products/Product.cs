using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Products;

public class Product
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("sku")]
    public string? Sku { get; set; }

    [JsonPropertyName("barcode")]
    public string? Barcode { get; set; }

    [JsonPropertyName("price")]
    public decimal Price { get; set; }

    [JsonPropertyName("stock")]
    public decimal Stock { get; set; }

    [JsonPropertyName("category_name")]
    public string? CategoryName { get; set; }

    // Populated from nested category object when category_name not directly available
    [JsonPropertyName("category")]
    public ProductCategory? Category { get; set; }

    public string ResolvedCategoryName => CategoryName ?? Category?.Name ?? "";

    public string StockDisplay => Stock % 1 == 0
        ? ((int)Stock).ToString()
        : Stock.ToString("0.##");

    public string PriceDisplay => $"${Price:F2}";
}

public class ProductCategory
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";
}

/// <summary>
/// Maps to PaginatedCatalog schema: { items, total, has_more }
/// </summary>
public class ProductListResponse
{
    [JsonPropertyName("items")]
    public List<Product> Items { get; set; } = new();

    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("has_more")]
    public bool HasMore { get; set; }
}

/// <summary>
/// Minimum fields required by POST /api/v1/products/
/// Only name and price are mandatory on ProductBase; everything else has defaults.
/// </summary>
public class ProductCreateRequest
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("sku")]
    public string? Sku { get; set; }

    [JsonPropertyName("price")]
    public decimal Price { get; set; }

    [JsonPropertyName("stock")]
    public decimal Stock { get; set; }

    [JsonPropertyName("cost_price")]
    public decimal CostPrice { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("category_id")]
    public int? CategoryId { get; set; }

    [JsonPropertyName("unit_type")]
    public string UnitType { get; set; } = "Unidad";

    [JsonPropertyName("min_stock")]
    public decimal MinStock { get; set; } = 5;

    [JsonPropertyName("is_service")]
    public bool IsService { get; set; } = false;

    // Required nested lists — send empty to satisfy schema
    [JsonPropertyName("units")]
    public List<object> Units { get; set; } = new();

    [JsonPropertyName("combo_items")]
    public List<object> ComboItems { get; set; } = new();

    [JsonPropertyName("warehouse_stocks")]
    public List<object> WarehouseStocks { get; set; } = new();

    [JsonPropertyName("prices")]
    public List<object> Prices { get; set; } = new();
}
