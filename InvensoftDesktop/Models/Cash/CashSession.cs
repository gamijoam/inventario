using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Cash;

public class CashSession
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("initial_cash")]
    public decimal OpeningAmount { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = "";

    [JsonPropertyName("start_time")]
    public DateTime OpenedAt { get; set; }

    [JsonPropertyName("register")]
    public RegisterInfo? Register { get; set; }

    public bool IsOpen => Status == "OPEN";
    public string RegisterName => Register?.Name ?? "";
}

public class RegisterInfo
{
    [JsonPropertyName("id")]   public int Id { get; set; }
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("code")] public string Code { get; set; } = "";
}

public class OpenSessionRequest
{
    [JsonPropertyName("opening_amount")]
    public decimal OpeningAmount { get; set; }

    [JsonPropertyName("register_id")]
    public int? RegisterId { get; set; }
}
