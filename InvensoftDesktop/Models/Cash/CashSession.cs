using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Cash;

public class CashSession
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("initial_cash")]
    public decimal OpeningAmount { get; set; }

    [JsonPropertyName("initial_cash_bs")]
    public decimal OpeningAmountBs { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = "";

    [JsonPropertyName("start_time")]
    public DateTime OpenedAt { get; set; }

    [JsonPropertyName("end_time")]
    public DateTime? ClosedAt { get; set; }

    [JsonPropertyName("user_id")]
    public int? UserId { get; set; }

    [JsonPropertyName("register")]
    public RegisterInfo? Register { get; set; }

    [JsonPropertyName("movements")]
    public List<CashMovement> Movements { get; set; } = new();

    public bool IsOpen => Status == "OPEN";
    public string RegisterName => Register?.Name ?? "Caja principal";
    public string OpenedAtDisplay => OpenedAt.ToString("dd/MM/yyyy HH:mm");
}

public class RegisterInfo
{
    [JsonPropertyName("id")]   public int Id { get; set; }
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("code")] public string Code { get; set; } = "";
}

public class CashMovement
{
    [JsonPropertyName("id")]          public int Id { get; set; }
    [JsonPropertyName("amount")]      public decimal Amount { get; set; }
    [JsonPropertyName("type")]        public string Type { get; set; } = "";
    [JsonPropertyName("currency")]    public string Currency { get; set; } = "USD";
    [JsonPropertyName("description")] public string Description { get; set; } = "";
    [JsonPropertyName("date")]        public DateTime Date { get; set; }

    public string TypeDisplay => Type switch
    {
        "IN"           => "Entrada",
        "OUT"          => "Salida",
        "CASH_ADVANCE" => "Adelanto",
        _              => Type
    };
    public string TypeColor => Type == "IN" ? "#059669" : "#DC2626";
    public string AmountDisplay => $"{(Type == "OUT" || Type == "CASH_ADVANCE" ? "-" : "+")}{Amount:F2} {Currency}";
}

public class OpenSessionRequest
{
    [JsonPropertyName("initial_cash")]
    public decimal InitialCash { get; set; }

    [JsonPropertyName("initial_cash_bs")]
    public decimal InitialCashBs { get; set; } = 0m;

    [JsonPropertyName("register_id")]
    public int? RegisterId { get; set; }
}

public class CloseSessionRequest
{
    [JsonPropertyName("final_cash_reported")]
    public decimal FinalCashReported { get; set; }

    [JsonPropertyName("final_cash_reported_bs")]
    public decimal FinalCashReportedBs { get; set; } = 0m;
}
