using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Customers;

public class Customer
{
    [JsonPropertyName("id")]                public int Id { get; set; }
    [JsonPropertyName("name")]              public string Name { get; set; } = "";
    [JsonPropertyName("id_number")]         public string? IdNumber { get; set; }
    [JsonPropertyName("phone")]             public string? Phone { get; set; }
    [JsonPropertyName("email")]             public string? Email { get; set; }
    [JsonPropertyName("address")]           public string? Address { get; set; }
    [JsonPropertyName("credit_limit")]      public decimal CreditLimit { get; set; }
    [JsonPropertyName("payment_term_days")] public int PaymentTermDays { get; set; } = 15;
    [JsonPropertyName("is_blocked")]        public bool IsBlocked { get; set; }
    [JsonPropertyName("is_active")]         public bool IsActive { get; set; } = true;

    public string StatusDisplay => IsBlocked ? "Bloqueado" : (IsActive ? "Activo" : "Inactivo");
    public string StatusColor   => IsBlocked ? "#DC2626"  : (IsActive ? "#059669" : "#94A3B8");
    public string CreditDisplay => $"${CreditLimit:F2}";
}

public class CustomerListResponse
{
    [JsonPropertyName("items")] public List<Customer> Items { get; set; } = new();
    [JsonPropertyName("total")] public int Total { get; set; }
}

public class CustomerCreate
{
    [JsonPropertyName("name")]              public string Name { get; set; } = "";
    [JsonPropertyName("id_number")]         public string? IdNumber { get; set; }
    [JsonPropertyName("phone")]             public string? Phone { get; set; }
    [JsonPropertyName("email")]             public string? Email { get; set; }
    [JsonPropertyName("address")]           public string? Address { get; set; }
    [JsonPropertyName("credit_limit")]      public decimal CreditLimit { get; set; } = 100m;
    [JsonPropertyName("payment_term_days")] public int PaymentTermDays { get; set; } = 15;
    [JsonPropertyName("is_blocked")]        public bool IsBlocked { get; set; } = false;
    [JsonPropertyName("is_active")]         public bool IsActive { get; set; } = true;
}
