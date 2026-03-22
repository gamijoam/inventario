using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvensoftDesktop.Core;
using InvensoftDesktop.Models.Quotes;
using System.Collections.ObjectModel;

namespace InvensoftDesktop.ViewModels;

public partial class QuotesViewModel : ViewModelBase
{
    private readonly ApiService _api;
    private readonly PrintService _print;

    [ObservableProperty] private ObservableCollection<Quote> _quotes = new();
    [ObservableProperty] private bool _isLoading = false;
    [ObservableProperty] private string _errorMessage = "";
    [ObservableProperty] private string _successMessage = "";
    [ObservableProperty] private int _totalCount = 0;
    [ObservableProperty] private int _currentPage = 1;

    private const int PageSize = 40;
    public bool HasMore => Quotes.Count < TotalCount;

    public QuotesViewModel(ApiService api, PrintService print)
    {
        _api = api;
        _print = print;
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        CurrentPage = 1;
        IsLoading = true;
        ErrorMessage = "";
        try
        {
            var skip = 0;
            var result = await _api.GetAsync<QuoteListResponse>($"quotes?skip={skip}&limit={PageSize}");
            Quotes.Clear();
            if (result != null)
            {
                TotalCount = result.Total;
                foreach (var q in result.Items) Quotes.Add(q);
            }
            OnPropertyChanged(nameof(HasMore));
        }
        catch (UnauthorizedAccessException) { ErrorMessage = "Sesión expirada."; }
        catch { ErrorMessage = "No se pudieron cargar las cotizaciones."; }
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
            var skip = (CurrentPage - 1) * PageSize;
            var result = await _api.GetAsync<QuoteListResponse>($"quotes?skip={skip}&limit={PageSize}");
            if (result != null)
                foreach (var q in result.Items) Quotes.Add(q);
            OnPropertyChanged(nameof(HasMore));
        }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task PrintQuoteAsync(Quote quote)
    {
        SuccessMessage = "";
        ErrorMessage = "";
        var (ok, err) = await _print.PrintQuoteAsync(quote.Id);
        if (ok) SuccessMessage = $"Cotización #{quote.Id} enviada a imprimir.";
        else    ErrorMessage = err;
    }

    [RelayCommand]
    private async Task ConvertQuoteAsync(Quote quote)
    {
        ErrorMessage = "";
        SuccessMessage = "";
        try
        {
            await _api.PostAsync<object, object>($"quotes/{quote.Id}/convert", new { });
            SuccessMessage = $"Cotización #{quote.Id} marcada como convertida.";
            await LoadAsync();
        }
        catch { ErrorMessage = "No se pudo convertir la cotización."; }
    }

    [RelayCommand]
    private async Task DeleteQuoteAsync(Quote quote)
    {
        ErrorMessage = "";
        try
        {
            await _api.DeleteAsync($"quotes/{quote.Id}");
            Quotes.Remove(quote);
            TotalCount--;
            OnPropertyChanged(nameof(HasMore));
        }
        catch { ErrorMessage = "No se pudo eliminar la cotización."; }
    }
}
