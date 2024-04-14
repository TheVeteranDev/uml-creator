import puppeteer from 'puppeteer';
import { getPostgresSchema } from './databaseConnection.js';
import sharp from 'sharp';
import fs from "fs";

const main = async (args) => {
    const [username, password, host, port, database] = args;
    let schemaTables = [];

    try {
        schemaTables = await getPostgresSchema(username, password, host, port, database);
    } catch (error) {
        console.error('Error:', error);
        return;
    }

    let mermaidString = "erDiagram\n";

    for (const [table, v] of schemaTables) {
        mermaidString += `\t${table} {\n`;

        const usedColumnNames = [];

        for (const c of v.columns) {
            if (usedColumnNames.includes(c.columnName)) {
                continue;
            }

            mermaidString += `\t\t${c.dataType.replace(" ", "_")} ${c.columnName}`;
            const keyStrings = [];
            if (c.isPrimaryKey) {
                keyStrings.push("PK");
            }

            if (c.isForeignKey) {
                keyStrings.push("FK");
            }   
            
            if (keyStrings.length > 0) {
                mermaidString += " " + keyStrings.join(", ");
            }
            
            mermaidString += "\n";

            usedColumnNames.push(c.columnName);
        }
        mermaidString += `\t}\n`;

        for (const r of v.relationships.oneToOne) {            
            mermaidString += `\t${r.tableName} ||--|| ${r.referencedTableName} : has\n`;
        }

        for (const r of v.relationships.oneToMany) {
            mermaidString += `\t${r.tableName} ||--o{ ${r.referencedTableName} : has\n`;
        }

        for (const r of v.relationships.manyToMany) {
            mermaidString += `\t${r.tableName} }o--o{ ${r.referencedTableName} : has\n`;
        }
    }

    const html = `
    <html style="height: 100%;">
        <body style="height: 100%;">
            <script type="module">
                import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
                mermaid.initialize({ startOnLoad: true });
            </script>

            <pre class="mermaid" style="margin: 0;">
                ${mermaidString}
            </pre>
        </body>
    </html>
    `;

    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        // Set the viewport to a large size to ensure the diagram is fully rendered
        await page.setViewport({ width: 2840, height: 2160 });


        console.log('Generating database UML diagram...');

        // Wait for the page to load
        await page.setContent(html, { waitUntil: 'load' });

        // Wait for the diagram to render
        setTimeout(async () => {
            // Create temporary screenshot
            await page.screenshot({ path: 'diagrams/screenshot.png' });

            await browser.close();

            // Trim the screenshot and remove the white background and save it as diagram.png
            await sharp('diagrams/screenshot.png')
                .flatten({ background: { r: 255, g: 255, b: 255, alpha: 0 } })
                .trim()
                .toFile('diagrams/diagram.png');
            
            // Deletes the temporary screen shot
            fs.unlink('diagrams/screenshot.png', err => {
                if (err) throw err;
            });

            console.log('Database UML diagram generated successfully!');
            process.exit(0);
        }, 1000);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }

}

main(process.argv.slice(2));
