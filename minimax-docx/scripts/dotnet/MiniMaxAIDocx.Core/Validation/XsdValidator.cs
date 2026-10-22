using System.IO.Compression;
using System.Xml;
using System.Xml.Schema;

namespace MiniMaxAIDocx.Core.Validation;

public class XsdValidator
{
    // The WML subset schema references two foreign namespaces that .NET does
    // not ship: relationships (r:id) and XML (xml:space). They are added to
    // the schema set explicitly so validation also works without a resolver.
    private static readonly (string Namespace, string FileName)[] CompanionSchemas =
    [
        ("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "relationships.xsd"),
        ("http://www.w3.org/XML/1998/namespace", "xml.xsd"),
    ];

    public ValidationResult Validate(string docxPath, string xsdPath)
    {
        using var zip = ZipFile.OpenRead(docxPath);
        var entry = zip.GetEntry("word/document.xml")
            ?? throw new InvalidOperationException("DOCX does not contain word/document.xml");

        using var stream = entry.Open();
        using var reader = new StreamReader(stream);
        var xmlContent = reader.ReadToEnd();

        return ValidateXml(xmlContent, xsdPath);
    }

    public ValidationResult ValidateXml(string xmlContent, string xsdPath)
    {
        var result = new ValidationResult();
        var settings = new XmlReaderSettings();

        var schemaSet = new XmlSchemaSet();

        try
        {
            var schemaDir = Path.GetDirectoryName(Path.GetFullPath(xsdPath));
            if (!string.IsNullOrEmpty(schemaDir))
            {
                foreach (var (ns, fileName) in CompanionSchemas)
                {
                    var companionPath = Path.Combine(schemaDir, fileName);
                    if (File.Exists(companionPath))
                        schemaSet.Add(ns, companionPath);
                }
            }

            schemaSet.Add(null, xsdPath);
            schemaSet.Compile();
        }
        catch (XmlSchemaException ex)
        {
            result.Errors.Add(new ValidationError
            {
                LineNumber = ex.LineNumber,
                LinePosition = ex.LinePosition,
                Message = $"XSD schema error: {ex.Message}",
                Severity = "Error"
            });
            return result;
        }

        settings.Schemas = schemaSet;
        settings.ValidationType = ValidationType.Schema;
        settings.ValidationFlags |= XmlSchemaValidationFlags.ReportValidationWarnings;

        settings.ValidationEventHandler += (sender, e) =>
        {
            var error = new ValidationError
            {
                LineNumber = e.Exception?.LineNumber ?? 0,
                LinePosition = e.Exception?.LinePosition ?? 0,
                Message = e.Message,
                Severity = e.Severity == XmlSeverityType.Warning ? "Warning" : "Error"
            };

            if (e.Severity == XmlSeverityType.Warning)
                result.Warnings.Add(error);
            else
                result.Errors.Add(error);
        };

        using var stringReader = new StringReader(xmlContent);
        using var xmlReader = XmlReader.Create(stringReader, settings);

        try
        {
            while (xmlReader.Read()) { }
        }
        catch (XmlException ex)
        {
            result.Errors.Add(new ValidationError
            {
                LineNumber = ex.LineNumber,
                LinePosition = ex.LinePosition,
                Message = $"XML parse error: {ex.Message}",
                Severity = "Error"
            });
        }

        return result;
    }
}
