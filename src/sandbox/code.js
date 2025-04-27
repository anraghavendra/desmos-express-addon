import addOnSandboxSdk from "add-on-sdk-document-sandbox";
import { editor } from "express-document-sdk";

// Get the document sandbox runtime.
const { runtime } = addOnSandboxSdk.instance;

function start() {
    // APIs to be exposed to the UI runtime
    // i.e., to the index.html file of this add-on.
    const sandboxApi = {
        createGraphImage: async (imageData) => {
            try {
                // Create a new image element
                const image = editor.createImage();

                // Convert the base64 image data to a blob
                const response = await fetch(imageData);
                const blob = await response.blob();

                // Set the image source
                image.source = blob;

                // Set image dimensions
                image.width = 800;
                image.height = 600;

                // Center the image on the canvas
                const canvasWidth = editor.context.document.width;
                const canvasHeight = editor.context.document.height;
                image.translation = {
                    x: (canvasWidth - image.width) / 2,
                    y: (canvasHeight - image.height) / 2
                };

                // Add the image to the document
                const insertionParent = editor.context.insertionParent;
                insertionParent.children.append(image);

                // Select the newly added image
                editor.context.selection.items = [image];
            } catch (error) {
                console.error("Error creating graph image:", error);
            }
        }
    };

    // Expose sandboxApi to the UI runtime.
    runtime.exposeApi(sandboxApi);
}

start();