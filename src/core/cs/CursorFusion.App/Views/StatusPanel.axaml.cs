using Avalonia.Controls;
using Avalonia.Data.Converters;
using System;
using System.Globalization;

namespace CursorFusion.App.Views;

public partial class StatusPanel : UserControl
{
    public static readonly IValueConverter BoolToStateConverter =
        new FuncValueConverter<bool, string>(pressed => pressed ? "down" : "up");

    public StatusPanel()
    {
        InitializeComponent();
    }
}