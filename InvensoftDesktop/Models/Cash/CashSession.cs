using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Cash;

public class CashSession
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("opening_amount")]
    public decimal OpeningAmount { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = "";

    [JsonPropertyName("opened_at")]
    public DateTime OpenedAt { get; set; }

    [JsonPropertyName("register_name")]
    public string? RegisterName { get; set; }

    public bool IsOpen => Status == "OPEN";
}

public class OpenSessionRequest
{
    [JsonPropertyName("opening_amount")]
    public decimal OpeningAmount { get; set; }

    [JsonPropertyName("register_id")]
    public int? RegisterId { get; set; }
}
