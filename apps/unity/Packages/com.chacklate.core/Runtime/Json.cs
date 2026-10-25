// Minimal JSON for the protocol: parses into Dictionary/List/string/double/bool/null and writes the same.
// Small on purpose, so the package needs nothing beyond the .NET base library that Unity ships.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Chacklate.Core
{
    public static class Json
    {
        public static object Parse(string s) { int i = 0; var v = Value(s, ref i); Ws(s, ref i); if (i != s.Length) throw new FormatException("Trailing JSON"); return v; }

        static void Ws(string s, ref int i) { while (i < s.Length && char.IsWhiteSpace(s[i])) i++; }
        static object Value(string s, ref int i)
        {
            Ws(s, ref i);
            if (i >= s.Length) throw new FormatException("Unexpected end of JSON");
            char c = s[i];
            if (c == '{')
            {
                var d = new Dictionary<string, object>(); i++; Ws(s, ref i);
                if (s[i] == '}') { i++; return d; }
                while (true)
                {
                    Ws(s, ref i); var k = Str(s, ref i); Ws(s, ref i);
                    if (s[i++] != ':') throw new FormatException("Expected :");
                    d[k] = Value(s, ref i); Ws(s, ref i);
                    if (s[i] == ',') { i++; continue; }
                    if (s[i++] == '}') return d;
                    throw new FormatException("Expected , or }");
                }
            }
            if (c == '[')
            {
                var l = new List<object>(); i++; Ws(s, ref i);
                if (s[i] == ']') { i++; return l; }
                while (true)
                {
                    l.Add(Value(s, ref i)); Ws(s, ref i);
                    if (s[i] == ',') { i++; continue; }
                    if (s[i++] == ']') return l;
                    throw new FormatException("Expected , or ]");
                }
            }
            if (c == '"') return Str(s, ref i);
            if (s.Length - i >= 4 && string.CompareOrdinal(s, i, "true", 0, 4) == 0) { i += 4; return true; }
            if (s.Length - i >= 5 && string.CompareOrdinal(s, i, "false", 0, 5) == 0) { i += 5; return false; }
            if (s.Length - i >= 4 && string.CompareOrdinal(s, i, "null", 0, 4) == 0) { i += 4; return null; }
            int st = i;
            while (i < s.Length && "+-0123456789.eE".IndexOf(s[i]) >= 0) i++;
            if (st == i) throw new FormatException("Bad JSON value at " + i);
            return double.Parse(s.Substring(st, i - st), CultureInfo.InvariantCulture);
        }
        static string Str(string s, ref int i)
        {
            if (s[i] != '"') throw new FormatException("Expected string");
            i++;
            var sb = new StringBuilder();
            while (s[i] != '"')
            {
                char c = s[i++];
                if (c != '\\') { sb.Append(c); continue; }
                char e = s[i++];
                switch (e)
                {
                    case 'n': sb.Append('\n'); break; case 't': sb.Append('\t'); break; case 'r': sb.Append('\r'); break;
                    case 'b': sb.Append('\b'); break; case 'f': sb.Append('\f'); break;
                    case 'u': sb.Append((char)Convert.ToInt32(s.Substring(i, 4), 16)); i += 4; break;
                    default: sb.Append(e); break;
                }
            }
            i++;
            return sb.ToString();
        }

        public static string Write(object v)
        {
            var sb = new StringBuilder();
            W(sb, v);
            return sb.ToString();
        }
        static void W(StringBuilder sb, object v)
        {
            switch (v)
            {
                case null: sb.Append("null"); break;
                case bool b: sb.Append(b ? "true" : "false"); break;
                case string s:
                    sb.Append('"');
                    foreach (char c in s)
                    {
                        if (c == '"' || c == '\\') sb.Append('\\').Append(c);
                        else if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                    }
                    sb.Append('"'); break;
                case IDictionary<string, object> d:
                    sb.Append('{'); bool first = true;
                    foreach (var kv in d) { if (!first) sb.Append(','); first = false; W(sb, kv.Key); sb.Append(':'); W(sb, kv.Value); }
                    sb.Append('}'); break;
                case System.Collections.IEnumerable list:
                    sb.Append('['); bool f2 = true;
                    foreach (var x in list) { if (!f2) sb.Append(','); f2 = false; W(sb, x); }
                    sb.Append(']'); break;
                case IFormattable n: sb.Append(n.ToString(null, CultureInfo.InvariantCulture)); break;
                default: W(sb, v.ToString()); break;
            }
        }

        // Typed reads from a parsed object.
        public static string Str(this Dictionary<string, object> d, string k) => d != null && d.TryGetValue(k, out var v) ? v as string : null;
        public static double Num(this Dictionary<string, object> d, string k, double def = 0) => d != null && d.TryGetValue(k, out var v) && v is double x ? x : def;
        public static bool Bool(this Dictionary<string, object> d, string k) => d != null && d.TryGetValue(k, out var v) && v is bool b && b;
        public static Dictionary<string, object> Obj(this Dictionary<string, object> d, string k) => d != null && d.TryGetValue(k, out var v) ? v as Dictionary<string, object> : null;
        public static List<object> Arr(this Dictionary<string, object> d, string k) => d != null && d.TryGetValue(k, out var v) ? v as List<object> : null;
    }
}
