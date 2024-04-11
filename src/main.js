import puppeteer from 'puppeteer';
import { getPostgresSchema } from './databaseConnection.js';
import sharp from 'sharp';

const main = async (args) => {
    const [username, password, host, port, database] = args;
    let schemaTables = [];

    try {
        schemaTables = await getPostgresSchema(username, "$" + password, host, port, database);
    } catch (error) {
        console.error('Error:', error);
        return;
    }

    let mermaidString = "erDiagram\n";

    let i = 0;
    const tables = Array.from(schemaTables.keys());

    for (const [table, columns] of schemaTables) {
        if (i > 0) {
            mermaidString += `\t${tables[i-1]} ||--o{ ${table} : contains\n`;
        }
        mermaidString += `\t${table} {\n`;

        for (const c of columns) {
            mermaidString += `\t\t${c.data_type} ${c.column_name}`;

            if (c.isPrimaryKey) {
                mermaidString += ' PK\n';
            } else {
                mermaidString += '\n';
            }
        }

        mermaidString += '\t} \n';

        i++;
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
        await page.setViewport({ width: 2840, height: 2160 });

        await page.setContent(html, { waitUntil: 'load' });

        setTimeout(async () => {
            await page.screenshot({ path: 'diagrams/screenshot.png' });

            await browser.close();

            console.log('Screenshot taken');

            await sharp('diagrams/screenshot.png')
                .flatten({ background: { r: 255, g: 255, b: 255, alpha: 0 } })
                .trim()
                .toFile('diagrams/diagram.png');

            process.exit(0);
        }, 2000);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }

}

main(process.argv.slice(2));
