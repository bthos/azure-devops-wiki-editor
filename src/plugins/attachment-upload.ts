
import { upload, uploadConfig, Uploader } from '@milkdown/kit/plugin/upload';
import { Ctx } from '@milkdown/kit/ctx';
import { AdoAttachmentService, IWikiContext } from '../services/attachment-service';
import { imageSchema } from '@milkdown/kit/preset/commonmark';

// Note: We might need to adjust imports if image-block/inline-image are not available or used differently
// For now, we focus on the upload plugin which handles drag & drop and paste

export function configureAttachmentUpload(ctx: Ctx, attachmentService: AdoAttachmentService) {
    // Configure drag-and-drop / paste upload plugin
    const uploader: Uploader = async (files, schema) => {
        const nodes = [];

        for (let i = 0; i < files.length; i++) {
            const file = files.item(i);
            if (!file) continue;

            try {
                const attachmentPath = await attachmentService.uploadAttachment(file);

                if (file.type.startsWith('image/')) {
                    // Create image node
                    const node = schema.nodes.image.createAndFill({
                        src: attachmentPath,
                        alt: file.name,
                    });
                    if (node) nodes.push(node);
                } else {
                    // Create link node for non-images
                    // We use a paragraph with a link inside
                    // schema.text('link text', [schema.marks.link.create({ href: ... })])
                    const linkMark = schema.marks.link.create({ href: attachmentPath });
                    const textNode = schema.text(file.name, [linkMark]);
                    const node = schema.nodes.paragraph.create({}, [textNode]);
                    
                    if (node) nodes.push(node);
                }
            } catch (error) {
                console.error('Upload failed:', error);
                // TODO: Show error notification to user
            }
        }

        return nodes;
    };

    ctx.update(uploadConfig.key, (prev) => ({
        ...prev,
        uploader,
    }));
}

export function transformToGitUrl(attachmentPath: string, wikiContext: IWikiContext): string {
    // Transform relative attachment path to full Git file URL
    // This is needed for preview/display in the editor if we want to show the image immediately
    // However, ADO might handle relative paths if the base is set correctly.
    // But for the editor preview, we might need the full URL.
    
    const { projectId, wikiId, wikiVersion } = wikiContext;
    const encodedPath = encodeURIComponent(attachmentPath);
    // Note: This URL format is for retrieving file content via REST API
    // It might need adjustment based on exact ADO version/API
    return `https://dev.azure.com/${projectId}/_apis/git/repositories/${wikiId}/items?path=${encodedPath}&versionDescriptor=${wikiVersion}`;
}
