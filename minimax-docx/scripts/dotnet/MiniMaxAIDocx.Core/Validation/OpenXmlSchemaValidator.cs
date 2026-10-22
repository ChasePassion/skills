using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Validation;

namespace MiniMaxAIDocx.Core.Validation;

/// <summary>
/// Validates a DOCX package against the ECMA-376 rules shipped with the
/// OpenXML SDK. Unlike a hand-maintained XSD subset, the SDK knows the full
/// element ordering and attribute model, so it does not report false
/// positives on ordinary Word documents.
/// </summary>
public class OpenXmlSchemaValidator
{
    public ValidationResult Validate(string docxPath, FileFormatVersions version = FileFormatVersions.Office2016)
    {
        var result = new ValidationResult();

        using var document = WordprocessingDocument.Open(docxPath, false);
        var validator = new OpenXmlValidator(version);

        foreach (var error in validator.Validate(document))
        {
            var location = error.Part?.Uri?.ToString() ?? "";
            if (error.Path?.XPath != null)
                location = $"{location} {error.Path.XPath}";

            var message = string.IsNullOrEmpty(location)
                ? error.Description
                : $"{location}: {error.Description}";

            var validationError = new ValidationError
            {
                Message = message,
                Severity = "Error"
            };

            result.Errors.Add(validationError);
        }

        return result;
    }
}
