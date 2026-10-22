using System.IO.Compression;
using System.Xml.Linq;

namespace MiniMaxAIDocx.Core.OpenXml;

/// <summary>
/// Locates package parts by their relationship type instead of assuming a
/// fixed file name. Templates may store the style definitions in
/// word/styles2.xml (or any other name), and the relationship is the only
/// reliable way to find the part that is actually in use.
/// </summary>
public static class PackageParts
{
    private const string DocumentRelationshipPart = "word/_rels/document.xml.rels";

    public static ZipArchiveEntry? GetStylesEntry(ZipArchive zip)
    {
        return GetRelatedPart(zip, "/styles") ?? zip.GetEntry("word/styles.xml");
    }

    public static ZipArchiveEntry? GetRelatedPart(ZipArchive zip, string relationshipTypeSuffix)
    {
        var relsEntry = zip.GetEntry(DocumentRelationshipPart);
        if (relsEntry != null)
        {
            using var stream = relsEntry.Open();
            var rels = XDocument.Load(stream);
            var relationship = rels.Root?
                .Elements()
                .FirstOrDefault(e => e.Name.LocalName == "Relationship"
                    && ((string?)e.Attribute("Type"))?.EndsWith(relationshipTypeSuffix, StringComparison.OrdinalIgnoreCase) == true);

            var target = (string?)relationship?.Attribute("Target");
            if (!string.IsNullOrEmpty(target))
            {
                var path = ResolveTarget("word", target);
                var entry = zip.GetEntry(path);
                if (entry != null) return entry;
            }
        }

        return null;
    }

    private static string ResolveTarget(string baseDir, string target)
    {
        if (target.StartsWith('/'))
            return target.TrimStart('/');

        var combined = baseDir.TrimEnd('/') + "/" + target;
        var segments = new List<string>();
        foreach (var segment in combined.Split('/'))
        {
            if (segment.Length == 0 || segment == ".") continue;
            if (segment == "..")
            {
                if (segments.Count > 0) segments.RemoveAt(segments.Count - 1);
                continue;
            }
            segments.Add(segment);
        }

        return string.Join("/", segments);
    }
}
