import json
import os

def slither_json_to_html_table(json_file_path="results.json", output_html_path="slither_results.html"):
    """
    Reads a Slither JSON report, formats it into an HTML table,
    and saves it to an HTML file.
    """
    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: JSON file '{json_file_path}' not found.")
        return
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from '{json_file_path}'. Is it valid JSON?")
        return

    findings = []
    # Define headers for the HTML table
    headers = ["ID", "Detector", "Impact", "Confidence", "Contract", "Function", "Description", "Line(s)"]

    if 'results' in data and 'detectors' in data['results']:
        for i, finding in enumerate(data['results']['detectors']):
            detector_name = finding.get('detector', '<N/A>')
            impact = finding.get('impact', '<N/A>')
            confidence = finding.get('confidence', '<N/A>')
            description = finding.get('description', '<N/A>').strip()

            contract_name = '<N/A>'
            function_name = '<N/A>'
            line_numbers = set()

            if 'elements' in finding:
                for element in finding['elements']:
                    if 'contract' in element:
                        contract_name = element['contract'].get('name', contract_name)
                    if 'function' in element:
                        function_name = element['function'].get('name', function_name)

                    if 'source_mapping' in element and 'lines' in element['source_mapping']:
                        line_numbers.update(element['source_mapping']['lines'])

            lines_str = ', '.join(map(str, sorted(list(line_numbers)))) if line_numbers else '<N/A>'

            findings.append({
                "ID": i + 1,
                "Detector": detector_name,
                "Impact": impact,
                "Confidence": confidence,
                "Contract": contract_name,
                "Function": function_name,
                "Description": description,
                "Line(s)": lines_str
            })
    else:
        print("No 'detectors' results found in the JSON file. Ensure it's a valid Slither output.")
        return

    if not findings:
        print("No findings with 'detectors' results were found to generate a table.")
        return

    # --- Generate HTML ---
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Slither Analysis Results</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background-color: #f4f4f4; color: #333; }
            h1 { color: #0056b3; }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
                box-shadow: 0 2px 3px rgba(0,0,0,0.1);
                background-color: #fff;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 12px;
                text-align: left;
                vertical-align: top;
            }
            th {
                background-color: #007bff;
                color: white;
                font-weight: bold;
            }
            tr:nth-child(even) {
                background-color: #f2f2f2;
            }
            tr:hover {
                background-color: #ddd;
            }
            .impact-High { color: #dc3545; font-weight: bold; } /* Red */
            .impact-Medium { color: #ffc107; font-weight: bold; } /* Yellow */
            .impact-Low { color: #17a2b8; } /* Cyan */
            .impact-Informational { color: #6c757d; } /* Gray */
        </style>
    </head>
    <body>
        <h1>Slither Analysis Results</h1>
        <table>
            <thead>
                <tr>
    """
    # Add table headers
    for header in headers:
        html_content += f"<th>{header}</th>\n"

    html_content += """
                </tr>
            </thead>
            <tbody>
    """
    # Add table rows
    for finding in findings:
        html_content += "<tr>\n"
        for header in headers:
            value = finding.get(header, '<N/A>')
            # Apply impact-based styling to the Impact column
            if header == "Impact":
                html_content += f"<td class='impact-{value}'>{value}</td>\n"
            else:
                # Basic HTML escaping for description to prevent rendering issues
                if header == "Description":
                    value = value.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('\n', '<br>')
                html_content += f"<td>{value}</td>\n"
        html_content += "</tr>\n"

    html_content += """
            </tbody>
        </table>
    </body>
    </html>
    """

    # Save the HTML to a file
    try:
        with open(output_html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        print(f"HTML table successfully saved to '{output_html_path}'")
        print(f"You can open '{output_html_path}' in your web browser to view the results.")
    except IOError as e:
        print(f"Error saving HTML file: {e}")

if __name__ == "__main__":
    # 1. Run Slither to generate your JSON report (if you haven't already):
    #    slither . --json results.json

    # 2. Then, run this Python script:
    slither_json_to_html_table("results.json", "slither_results_table.html")