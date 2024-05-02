const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const PDFParser = require("pdf-parse");

require("dotenv").config();

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 8081;

const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

const MODEL_NAME = "gemini-1.0-pro";
const API_KEY = process.env.API_KEY;

async function runChat(userInput) {
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const generationConfig = {
    temperature: 1,
    topK: 0,
    topP: 0.95,
    maxOutputTokens: 8192,
  };

  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ];

  const chat = model.startChat({
    generationConfig,
    safetySettings,
    history: [
      {
        role: "user",
        parts: [
          {
            text: "You are an ai tool called GetAJob which analyze resume of users and provide specific points such as postives in the resume, things that can be dropped from the resume, what specific things from job description can be added to have better chances of selection.\n\nAlso you will provide a score from 0 to 100 of the resume based on correctness.\n\nYou will get resume details as Resume: {text extracted from pdf} and a job description: {text}. \n\nJust provide the final  answer in a json format along with the score and nothing else",
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: '```json\n{\n  "score": 85,\n  "positives": [\n    "Strong action verbs used to describe accomplishments.",\n    "Quantifiable achievements highlighted, showcasing impact.",\n    "Clear and concise formatting, making it easy to read."\n  ],\n  "drop": [\n    "Outdated or irrelevant skills that don\'t align with the job description.",\n    "Personal details like age, marital status, or hobbies (unless relevant).",\n    "References – instead, have a separate document ready if requested."\n  ],\n  "add_from_job_description": [\n    "Specific keywords mentioned in the job description, especially those related to required skills and experience.",\n    "Tailored achievements that directly address the responsibilities outlined in the job posting.",\n    "Examples of projects or initiatives that demonstrate your ability to excel in the desired role."\n  ]\n}\n```',
          },
        ],
      },
    ],
  });

  const result = await chat.sendMessage(userInput);
  const response = result.response;
  return response.text();
}

// runChat();

app.get("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen("" + PORT, function () {
  console.log("Port Connected....");
});

const upload = multer({ dest: "uploads/" }); // Adjust 'uploads/' as needed

app.post("/pdf", upload.single("resume"), async (req, res) => {
  try {
    const resumeFile = req.file;
    const jobDescription = req.body.jobDescription;

    if (!resumeFile) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const fileData = fs.readFileSync(resumeFile.path);
    const parsedData = await PDFParser(fileData);
    const resumeText = parsedData.text;

    const resumeAnalyses = await runChat(
      "Resume: " + resumeText + "Description: " + jobDescription
    );

    // Correct the string format
    const correctedString = resumeAnalyses.replace(/json|`/g, "").trim();

    // Parse the corrected JSON string
    const jsonObject = JSON.parse(correctedString);

    // Respond with extracted text
    res.json({ resume: jsonObject });

    // Clean up uploaded file (optional)
    fs.unlinkSync(resumeFile.path);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error processing PDF" });
  }
});
