<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vortex | Creative Voting</title>
    <link rel="stylesheet" href="/style.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>

    <div class="glass-container">
        <header>
            <h1>Vortex Vote ⚡</h1>
            <p id="status-text">Create your first poll below</p>
        </header>

        <!-- View 1: Creation Form -->
        <div id="create-view" class="view">
            <div class="input-group">
                <input type="text" id="poll-question" placeholder="Ask something cool..." required>
            </div>
            <div class="options-inputs" id="options-inputs">
                <input type="text" class="opt-input" id="opt1" placeholder="Option 1">
                <input type="text" class="opt-input" id="opt2" placeholder="Option 2">
            </div>
            <button class="add-option-btn" onclick="addOption()">+ Add Option</button>
            <button class="main-btn" onclick="launchPoll()">Launch Poll</button>
            <button class="secondary-btn" onclick="viewAllPolls()">View All Polls</button>
        </div>

        <!-- View 2: Voting Area (Hidden initially) -->
        <div id="vote-view" class="view hidden">
            <h2 id="display-question"></h2>
            <div id="vote-options"></div>
            <button class="secondary-btn" style="margin-top:20px" onclick="showCreate()">Back</button>
        </div>

        <!-- View 3: Results Area (Hidden initially) -->
        <div id="result-view" class="view hidden">
            <h2>Live Results</h2>
            <div id="results-display"></div>
            <button class="secondary-btn" onclick="resetPoll()">Create New Poll</button>
        </div>

        <!-- View 4: All Polls (Hidden initially) -->
        <div id="polls-view" class="view hidden">
            <h2>Active Polls</h2>
            <div id="polls-list"></div>
            <button class="secondary-btn" onclick="showCreate()">Create New</button>
        </div>
    </div>

    <script src="/script.js"></script>
</body>
</html>
