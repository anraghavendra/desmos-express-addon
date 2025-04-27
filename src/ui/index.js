import addOnUISdk from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";

addOnUISdk.ready.then(async () => {
    console.log("addOnUISdk is ready for use.");

    const { runtime } = addOnUISdk.instance;

    const equationsContainer = document.getElementById("equations-container");
    const addEquationButton = document.getElementById("addEquation");
    const createGraphButton = document.getElementById("createGraph");
    const graphContainer = document.getElementById("graph-container");

    const script = document.createElement("script");
    script.src = "https://www.desmos.com/api/v1.7/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6";
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