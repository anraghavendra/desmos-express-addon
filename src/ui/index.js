import addOnUISdk from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";
import config from '../config.js';

addOnUISdk.ready.then(async () => {
    console.log("addOnUISdk is ready for use.");

    const { runtime } = addOnUISdk.instance;

    const equationsContainer = document.getElementById("equations-container");
    const addEquationButton = document.getElementById("addEquation");
    const createGraphButton = document.getElementById("createGraph");
    const graphContainer = document.getElementById("graph-container");
    const geminiPrompt = document.getElementById("gemini-prompt");
    const generateGraphButton = document.getElementById("generate-graph");
    const generateQuestionsButton = document.getElementById("generate-questions");
    const questionsOutput = document.getElementById("questions-output");
    const difficultySelect = document.getElementById("difficulty");
    const questionTypeCheckboxes = {
        derivative: document.getElementById("type-derivative"),
        integral: document.getElementById("type-integral"),
        intercepts: document.getElementById("type-intercepts"),
        area: document.getElementById("type-area")
    };

    // Function to handle Gemini prompt
    async function handleGeminiPrompt() {
        const prompt = geminiPrompt.value.trim();
        if (!prompt) return;

        // Clear previous error
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) errorDiv.textContent = '';

        try {
            generateGraphButton.disabled = true;
            generateGraphButton.textContent = "Generating...";

            // Use the correct Gemini v1 endpoint with the new Gemini 2.0 Flash model
            const response = await fetch(`${config.api.gemini.endpoint}?key=${config.api.gemini.key}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `You are a math expert. Convert this request into Desmos equations: "${prompt}". \nReturn ONLY the equations in a format that can be directly used in Desmos, one per line.\nFor example, if the request is \"create a heart shape\", you might return:\nx^2 + (y - sqrt(abs(x)))^2 = 1\nx^2 + (y + sqrt(abs(x)))^2 = 1`
                        }]
                    }]
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || "Failed to generate equations");
            }

            const equations = data.candidates[0].content.parts[0].text
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('```'));

            equationsContainer.innerHTML = '';
            equationCount = 0;

            equations.forEach((equation, index) => {
                const container = createEquationInput(index);
                const input = container.querySelector('input');
                input.value = equation;
                equationsContainer.appendChild(container);
                equationCount++;
            });

            updateGraph();
            geminiPrompt.value = "";

        } catch (error) {
            console.error("Error processing Gemini prompt:", error);
            if (errorDiv) errorDiv.textContent = "Failed to generate equations: " + error.message;
        } finally {
            generateGraphButton.disabled = false;
            generateGraphButton.textContent = "Generate Graph";
        }
    }

    // Add event listener for the generate graph button
    generateGraphButton.addEventListener("click", handleGeminiPrompt);

    const script = document.createElement("script");
    script.src = `https://www.desmos.com/api/v1.7/calculator.js?apiKey=${config.api.desmos.key}`;
    script.async = true;
    document.head.appendChild(script);

    let calculator;
    let equationCount = 1;

    // Function to convert data URL to Blob
    function dataURLtoBlob(dataURL) {
        const byteString = atob(dataURL.split(',')[1]);
        const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], { type: mimeString });
    }

    // Function to format special functions in LaTeX
    function formatEquation(equation) {
        // First handle sqrt with its argument
        equation = equation.replace(/\bsqrt\s*\(([^)]+)\)/g, '\\sqrt{$1}');

        // Replace 'theta' (case-insensitive) and the Unicode θ symbol with LaTeX \\theta
        equation = equation.replace(/theta/gi, '\\theta').replace(/θ/g, '\\theta');

        // Then handle other functions
        return equation
            .replace(/\bsin\b/g, '\\sin')
            .replace(/\bcos\b/g, '\\cos')
            .replace(/\btan\b/g, '\\tan')
            .replace(/\blog\b/g, '\\log')
            .replace(/\bln\b/g, '\\ln')
            .replace(/\bexp\b/g, '\\exp')
            .replace(/\babs\b/g, '\\left|')
            .replace(/\bpi\b/g, '\\pi');
    }

    // Function to extract variables from an equation
    function extractVariables(equation) {
        // Remove spaces and split by operators
        const cleanEq = equation.replace(/\s+/g, '');
        const variables = new Set();

        // Match variables (letters that are not part of function names)
        const matches = cleanEq.match(/[a-zA-Z]+/g);
        if (matches) {
            matches.forEach(match => {
                // Skip if it's a function name or 'x'/'y'
                if (!['sin', 'cos', 'tan', 'log', 'ln', 'exp', 'sqrt', 'x', 'y'].includes(match.toLowerCase())) {
                    variables.add(match);
                }
            });
        }

        return Array.from(variables);
    }

    // Function to create a new equation input
    function createEquationInput(index) {
        const equationContainer = document.createElement('div');
        equationContainer.className = 'equation-container';
        equationContainer.setAttribute('data-index', index);

        const inputContainer = document.createElement('div');
        inputContainer.className = 'input-container';

        const inputWrapper = document.createElement('div');
        inputWrapper.style.display = 'flex';
        inputWrapper.style.gap = '8px';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `equation-${index}`;
        input.placeholder = 'e.g., y = x^2';

        const removeButton = document.createElement('button');
        removeButton.className = 'remove-equation-button';
        removeButton.textContent = '×';
        removeButton.onclick = () => removeEquation(index);

        inputWrapper.appendChild(input);
        inputWrapper.appendChild(removeButton);
        inputContainer.appendChild(inputWrapper);
        equationContainer.appendChild(inputContainer);

        return equationContainer;
    }

    // Function to remove an equation input
    function removeEquation(index) {
        // Don't allow removing the first equation
        if (index === 0) return;

        const container = document.querySelector(`.equation-container[data-index="${index}"]`);
        if (container) {
            container.remove();
            // Remove the expression from the calculator
            calculator.removeExpression({ id: `graph${index}` });
            // Reindex remaining equations
            reindexEquations();
            updateGraph();
        }
    }

    // Function to reindex equations after removal
    function reindexEquations() {
        const containers = document.querySelectorAll('.equation-container');
        containers.forEach((container, newIndex) => {
            container.setAttribute('data-index', newIndex);
            const input = container.querySelector('input');
            if (input) {
                input.id = `equation-${newIndex}`;
            }
        });
        equationCount = containers.length;
    }

    // Function to update the graph with all equations
    function updateGraph() {
        calculator.setExpressions([]);
        let hasValidEquation = false;

        document.querySelectorAll('.equation-container').forEach((container, index) => {
            const input = document.getElementById(`equation-${index}`);
            if (!input) return;

            const equation = input.value.trim();
            if (equation) {
                hasValidEquation = true;
                const formattedEquation = formatEquation(equation);
                calculator.setExpression({
                    id: `graph${index}`,
                    latex: formattedEquation
                });
            }
        });

        createGraphButton.disabled = !hasValidEquation;
    }

    // Function to get current graph equations
    function getCurrentGraphEquations() {
        const equations = [];
        document.querySelectorAll('.equation-container').forEach(container => {
            const input = container.querySelector('input');
            if (input && input.value.trim()) {
                equations.push(input.value.trim());
            }
        });
        return equations;
    }

    // Function to generate questions based on the current graph
    async function generateQuestions() {
        const equations = getCurrentGraphEquations();
        if (equations.length === 0) {
            questionsOutput.innerHTML = '<div class="error">Please create a graph first before generating questions.</div>';
            return;
        }

        const selectedTypes = Object.entries(questionTypeCheckboxes)
            .filter(([_, checkbox]) => checkbox.checked)
            .map(([type, _]) => type);

        if (selectedTypes.length === 0) {
            questionsOutput.innerHTML = '<div class="error">Please select at least one question type.</div>';
            return;
        }

        const difficulty = difficultySelect.value;
        generateQuestionsButton.disabled = true;
        generateQuestionsButton.textContent = "Generating...";
        questionsOutput.innerHTML = '<div class="loading">Generating questions...</div>';

        try {
            const prompt = `Generate ${difficulty} difficulty math questions based on these equations: ${equations.join(', ')}. 
            Include questions about: ${selectedTypes.join(', ')}. 
            Format each question with a clear question text and answer. 
            Return ONLY a valid JSON object with this exact structure (no markdown formatting, no additional text):
            {
                "questions": [
                    {
                        "type": "question type",
                        "question": "question text",
                        "answer": "answer text"
                    }
                ]
            }`;

            const response = await fetch(`${config.api.gemini.endpoint}?key=${config.api.gemini.key}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.message || "Failed to generate questions");
            }

            const questionsText = data.candidates[0].content.parts[0].text;
            // Remove markdown formatting if present
            const cleanJson = questionsText.replace(/```json\n?|\n?```/g, '').trim();
            const questions = JSON.parse(cleanJson).questions;

            questionsOutput.innerHTML = questions.map(q => `
                <div class="question-item">
                    <h4>${q.type}</h4>
                    <p><strong>Question:</strong> ${q.question}</p>
                    <p><strong>Answer:</strong> ${q.answer}</p>
                </div>
            `).join('');

        } catch (error) {
            console.error("Error generating questions:", error);
            questionsOutput.innerHTML = `<div class="error">Error generating questions: ${error.message}</div>`;
        } finally {
            generateQuestionsButton.disabled = false;
            generateQuestionsButton.textContent = "Generate Questions";
        }
    }

    // Add event listener for the generate questions button
    generateQuestionsButton.addEventListener("click", generateQuestions);

    script.onload = () => {
        calculator = Desmos.GraphingCalculator(graphContainer, {
            keypad: false,
            expressions: false,
            settingsMenu: false,
            zoomButtons: false
        });

        // Add event listener for the first equation input
        document.getElementById('equation-0').addEventListener('input', updateGraph);

        // Add event listeners for axis settings
        const axisInputs = ['xMin', 'xMax', 'yMin', 'yMax', 'xStep', 'yStep'];
        axisInputs.forEach(inputId => {
            document.getElementById(inputId).addEventListener('change', updateAxisSettings);
        });

        // Function to update axis settings
        function updateAxisSettings() {
            const xMin = parseFloat(document.getElementById('xMin').value);
            const xMax = parseFloat(document.getElementById('xMax').value);
            const yMin = parseFloat(document.getElementById('yMin').value);
            const yMax = parseFloat(document.getElementById('yMax').value);
            const xStep = parseFloat(document.getElementById('xStep').value);
            const yStep = parseFloat(document.getElementById('yStep').value);

            calculator.setMathBounds({
                left: xMin,
                right: xMax,
                bottom: yMin,
                top: yMax
            });

            calculator.setGraphSettings({
                xAxisStep: xStep,
                yAxisStep: yStep
            });
        }

        // Add event listener for the "Add Equation" button
        addEquationButton.addEventListener('click', () => {
            const newContainer = createEquationInput(equationCount);
            equationsContainer.appendChild(newContainer);

            // Add event listener for the new input
            document.getElementById(`equation-${equationCount}`).addEventListener('input', updateGraph);

            equationCount++;
        });

        createGraphButton.addEventListener("click", async () => {
            const equations = Array.from(document.querySelectorAll('.equation-container'))
                .map(container => {
                    const input = document.getElementById(`equation-${container.dataset.index}`);
                    return input.value.trim();
                })
                .filter(equation => equation);

            const imageDataUrl = calculator.screenshot({
                width: 800,
                height: 600,
                targetPixelRatio: 2
            });

            // Convert data URL to Blob
            const imageBlob = dataURLtoBlob(imageDataUrl);

            try {
                // Add the image to the Adobe Express document
                await addOnUISdk.app.document.addImage(imageBlob, {
                    title: `Graph of ${equations.join(', ')}`,
                    author: "Generated by Graphing Add-on"
                });
                console.log("Graph image added to the document.");
            } catch (error) {
                console.error("Error adding image to document:", error);
            }
        });

        createGraphButton.disabled = true;
    };
});