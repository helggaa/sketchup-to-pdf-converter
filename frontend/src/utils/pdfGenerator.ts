import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type AnnotationData = {
    title: string;
    scale_label?: string;
};

type PdfView = {
    image_data: string;
    annotation: AnnotationData | null;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

function base64ToUint8Array(base64: string): Uint8Array {
    const clean = base64.includes(',')
        ? base64.split(',')[1]
        : base64;

    const binary = window.atob(clean);

    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

export async function generatePdf(
    views: PdfView[],
    filename: string
): Promise<void> {
    const pdf = await PDFDocument.create();

    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

    const normalFont = await pdf.embedFont(StandardFonts.Helvetica);

    for (const view of views) {
        const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

        const imageBytes = base64ToUint8Array(view.image_data);

        let image;

        try {
            image = await pdf.embedPng(imageBytes);
        } catch {
            image = await pdf.embedJpg(imageBytes);
        }

        page.drawImage(image, {
            x: 0,
            y: 0,
            width: PAGE_WIDTH,
            height: PAGE_HEIGHT,
        });

        if (view.annotation) {
            page.drawRectangle({
                x: 0,
                y: 20,
                width: PAGE_WIDTH,
                height: 40,
                color: rgb(1, 1, 1),
                opacity: 0.75,
            });

            page.drawText(view.annotation.title, {
                x: 24,
                y: 42,
                size: 14,
                font: boldFont,
            });

            if (view.annotation.scale_label) {
                page.drawText(view.annotation.scale_label, {
                    x: 24,
                    y: 28,
                    size: 10,
                    font: normalFont,
                });
            }
        }
    }

    const bytes = await pdf.save();

    const arrayBuffer = bytes.slice().buffer as ArrayBuffer;

    const blob = new Blob([arrayBuffer], {
        type: 'application/pdf',
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
}