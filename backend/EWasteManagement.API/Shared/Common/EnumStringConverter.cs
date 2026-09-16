using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace EWasteManagement.API.Shared.Common;

/// <summary>
/// One generic converter for every enum -> lowercase-string column, instead of writing a
/// separate ternary chain per enum in each EF configuration file.
/// </summary>
public static class EnumStringConverter
{
    public static ValueConverter<TEnum, string> Create<TEnum>() where TEnum : struct, Enum
        => new ValueConverter<TEnum, string>(
            value => value.ToString().ToLowerInvariant(),
            stored => Enum.Parse<TEnum>(stored, true));
}
