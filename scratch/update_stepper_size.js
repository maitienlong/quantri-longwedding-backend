const fs = require('fs');

const filePath = 'D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/ThemHopDongDialog.css';

let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings
content = content.replace(/\r/g, '');

const targetPart = `/* Progress Stepper Styles */
.dialog-progress {
    background-color: #fcfcfc;
    border-bottom: 1px solid var(--border-color);
    padding: 24px 20px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.stepper-wrapper {
    display: flex;
    align-items: center;
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    justify-content: space-between;
}

.step-container {
    display: flex;
    align-items: center;
    flex: 1;
}

.step-container:last-child {
    flex: none;
}

.step-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    position: relative;
    user-select: none;
    z-index: 2;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.step-icon-wrap {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background-color: #ffffff;
    border: 2px solid #e0e0e0;
    color: #9e9e9e;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    position: relative;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.step-badge-check {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-color: #2e7d32;
    color: white;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    border: 1px solid white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.step-label {
    margin-top: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    color: #757575;
    text-align: center;
    white-space: nowrap;
    transition: all 0.3s ease;
}

/* Step Line */
.step-line {
    height: 3px;
    background-color: #e0e0e0;
    flex-grow: 1;
    margin: 0 10px;
    transform: translateY(-12px);
    border-radius: 2px;
    transition: all 0.5s ease;
    z-index: 1;
}

.step-line.filled {
    background-color: var(--primary-color);
    box-shadow: 0 0 4px rgba(212, 175, 55, 0.2);
}`;

const replacementPart = `/* Progress Stepper Styles */
.dialog-progress {
    background-color: #fcfcfc;
    border-bottom: 1px solid var(--border-color);
    padding: 12px 10px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.stepper-wrapper {
    display: flex;
    align-items: center;
    width: 100%;
    max-width: 450px;
    margin: 0 auto;
    justify-content: space-between;
}

.step-container {
    display: flex;
    align-items: center;
    flex: 1;
}

.step-container:last-child {
    flex: none;
}

.step-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    position: relative;
    user-select: none;
    z-index: 2;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.step-icon-wrap {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: #ffffff;
    border: 1.5px solid #e0e0e0;
    color: #9e9e9e;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    position: relative;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.step-badge-check {
    position: absolute;
    bottom: -3px;
    right: -3px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #2e7d32;
    color: white;
    font-size: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    border: 1px solid white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.step-label {
    margin-top: 4px;
    font-size: 0.72rem;
    font-weight: 500;
    color: #757575;
    text-align: center;
    white-space: nowrap;
    transition: all 0.3s ease;
}

/* Step Line */
.step-line {
    height: 2px;
    background-color: #e0e0e0;
    flex-grow: 1;
    margin: 0 5px;
    transform: translateY(-7px);
    border-radius: 1px;
    transition: all 0.5s ease;
    z-index: 1;
}

.step-line.filled {
    background-color: var(--primary-color);
    box-shadow: 0 0 2px rgba(212, 175, 55, 0.2);
}`;

console.log("[stepperCSS] Match found:", content.includes(targetPart));
content = content.replace(targetPart, replacementPart);

// Convert back to CRLF
content = content.split('\n').join('\r\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log("ThemHopDongDialog.css updated with half-size stepper dimensions.");
