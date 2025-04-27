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

            const response = await fetch(`${config.api.gemini.endpoint}?key=${config.api.gemini.key}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `You are a math teacher who specializes in creating educational examples. Generate mathematical equations based on this request: "${prompt}".
                            
Requirements:
1. Return ONLY the equations in a format that can be directly used in Desmos, one per line
2. Each equation should demonstrate a different variation or concept within the requested topic
3. Make equations that are clear and educational, suitable for teaching
4. Use standard form unless specifically requested otherwise
5. Include a good range of complexity levels

For example, if asked for "generate 3 equations for parabolas", you might return:
y = x^2
y = -2(x - 3)^2 + 4
y = 0.5x^2 - 2x - 1`
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

    // Function to create a question card
    function createQuestionCard(question, answer) {
        const card = document.createElement('div');
        card.className = 'question-card';
        
        const questionText = document.createElement('div');
        questionText.className = 'question-text';
        questionText.textContent = question;
        
        const cardActions = document.createElement('div');
        cardActions.className = 'card-actions';
        
        const showAnswerBtn = document.createElement('button');
        showAnswerBtn.className = 'card-button show-answer';
        showAnswerBtn.textContent = 'Show Answer';
        
        const answerText = document.createElement('div');
        answerText.className = 'answer-text';
        answerText.textContent = answer;
        answerText.style.display = 'none';
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'card-button copy';
        copyBtn.textContent = 'Copy';
        
        showAnswerBtn.onclick = () => {
            const isAnswerShown = answerText.style.display !== 'none';
            answerText.style.display = isAnswerShown ? 'none' : 'block';
            showAnswerBtn.textContent = isAnswerShown ? 'Show Answer' : 'Hide Answer';
            copyBtn.textContent = 'Copy';  // Reset copy button text
        };
        
        copyBtn.onclick = async () => {
            try {
                const isAnswerShown = answerText.style.display !== 'none';
                const textToCopy = isAnswerShown ? answer : question;
                
                // Create a temporary textarea element
                const textarea = document.createElement('textarea');
                textarea.value = textToCopy;
                textarea.style.position = 'fixed';  // Prevent scrolling to bottom
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                
                // Execute copy command
                document.execCommand('copy');
                
                // Remove temporary element
                document.body.removeChild(textarea);
                
                // Update button text
                copyBtn.textContent = isAnswerShown ? 'Answer Copied!' : 'Question Copied!';
                setTimeout(() => copyBtn.textContent = 'Copy', 1000);
            } catch (error) {
                console.error('Failed to copy text:', error);
                copyBtn.textContent = 'Copy Failed';
                setTimeout(() => copyBtn.textContent = 'Copy', 1000);
            }
        };
        
        cardActions.appendChild(showAnswerBtn);
        cardActions.appendChild(copyBtn);
        
        card.appendChild(questionText);
        card.appendChild(answerText);
        card.appendChild(cardActions);
        
        return card;
    }

    // Function to handle question generation
    async function generateQuestions() {
        const equations = getCurrentGraphEquations();
        if (equations.length === 0) {
            questionsOutput.innerHTML = '<div class="error">Please create a graph first before generating questions.</div>';
            return;
        }

        try {
            generateQuestionsButton.disabled = true;
            generateQuestionsButton.textContent = "Generating...";

            const questionType = document.getElementById('question-type').value.trim();
            if (!questionType) {
                throw new Error("Please enter a question topic");
            }

            const prompt = `Using these equations: ${equations.join(', ')}, generate ${difficultySelect.value} difficulty math questions about ${questionType}.
                Focus specifically on how ${questionType} relates to these exact equations.
                
                IMPORTANT: Format your response EXACTLY as follows, with each question-answer pair separated by | and each pair on a new line:
                Question: What is the derivative of y = x^2? | Answer: The derivative is dy/dx = 2x
                Question: What is the integral of y = 2x? | Answer: The integral is y = x^2 + C
                
                Generate 3-4 questions with step-by-step solutions in the answers.`;

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

            const text = data.candidates[0].content.parts[0].text;
            const pairs = text.split('\n')
                .map(line => line.trim())
                .filter(line => line && line.includes('Question:'))
                .map(line => {
                    const parts = line.split('|');
                    if (parts.length < 2) {
                        // If no | separator, try to split by "Answer:"
                        const fullText = parts[0];
                        const questionMatch = fullText.match(/Question:(.*?)(?=Answer:)/i);
                        const answerMatch = fullText.match(/Answer:(.*)/i);
                        
                        return {
                            question: questionMatch ? questionMatch[1].trim() : fullText,
                            answer: answerMatch ? answerMatch[1].trim() : "No answer provided"
                        };
                    }
                    return {
                        question: parts[0].replace('Question:', '').trim(),
                        answer: parts[1].replace('Answer:', '').trim()
                    };
                });
            
            if (pairs.length === 0) {
                throw new Error("No valid questions generated. Please try again.");
            }
            
            questionsOutput.innerHTML = '';
            const container = document.createElement('div');
            container.className = 'questions-container';
            
            pairs.forEach(({ question, answer }) => {
                const card = createQuestionCard(question, answer);
                container.appendChild(card);
            });
            
            questionsOutput.appendChild(container);

        } catch (error) {
            console.error("Error generating questions:", error);
            questionsOutput.innerHTML = `<div class="error">Failed to generate questions: ${error.message}</div>`;
        } finally {
            generateQuestionsButton.disabled = false;
            generateQuestionsButton.textContent = "Generate Questions";
        }
    }

    // Add event listener for the generate questions button
    generateQuestionsButton.addEventListener("click", generateQuestions);

    // Add event listeners for drag and drop events
    addOnUISdk.app.on("dragstart", (eventData) => {
        console.log("Drag started for question card");
    });

    addOnUISdk.app.on("dragend", (eventData) => {
        if (!eventData.dropCancelled) {
            console.log("Question card dropped successfully");
        } else {
            console.log("Drop cancelled:", eventData.dropCancelReason);
        }
    });

    // Remove the canvas drop event listeners since we're using the SDK now
    document.removeEventListener('DOMContentLoaded', () => {});

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

    // Update the generate questions section with new classes
    const generateQuestionsSection = document.querySelector('.generate-questions-section');
    generateQuestionsSection.className = 'generate-questions-section';
    
    const questionTypeContainer = document.querySelector('.question-type-container');
    questionTypeContainer.className = 'question-type-container';
    
    // Update checkboxes
    const checkboxes = questionTypeContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        const container = checkbox.parentElement;
        container.className = 'question-type-checkbox';
    });
    
    // Update generate button
    const generateButton = document.querySelector('.generate-questions-button');
    generateButton.className = 'generate-questions-button';
});

async function createTextbox() {
    try {
        const editor = await window.AddOnSdk.app.editor;
        if (!editor) {
            console.error("Editor is not available");
            return;
        }
        
        const textbox = await editor.createText({
            text: "Enter text here",
            fontSize: 24,
            color: { red: 0, green: 0, blue: 0 },
            position: { x: 100, y: 100 }
        });
        
        console.log("Textbox created successfully");
    } catch (error) {
        console.error("Error creating textbox:", error);
    }
}