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
      temperature: 0.66,
      topK: 1,
      topP: 1,
      maxOutputTokens: 2048,
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
          parts: [{ text: "You are an ai tool called ResumeRadar which analyze resume of users and provide specific strong points from the resume  that relates with the job description, provide the specific things from the resume which can dropped [Note: Personal details Linkedin and Social links are important and should not be added in dropped section], at last mention specific things in the resume that can be modified based on the job description to have better chances of shortlisting .\n\nAlso you will provide a score from 0 to 100 of the resume based on how likely the resume matches with the job description.\n\nYou will get resume details as Resume: {text extracted from pdf file} and a job description: {text}\n\nReturn the final response in a json format {positives, drop, add_from_job_description, score}"}],
        },
        {
          role: "model",
          parts: [{ text: "**Resume:**\n\n```\nJohn Doe\n123 Main Street\nAnytown, CA 12345\n(123) 456-7890\njohn.doe@email.com\nlinkedin.com/in/johndoe\ngithub.com/johndoe\n\nSummary\n\nHighly motivated and results-oriented software engineer with 5+ years of experience in designing, developing, and maintaining enterprise-scale applications. Proven ability to work independently and as part of a team to deliver high-quality software solutions.\n\nSkills\n\n* Programming Languages: Java, Python, C++, JavaScript\n* Cloud Computing: AWS, Azure, GCP\n* Databases: MySQL, PostgreSQL, MongoDB\n* Software Development Methodologies: Agile, Scrum, Kanban\n* Version Control: Git, SVN\n\nExperience\n\nSoftware Engineer, ABC Corporation, Anytown, CA (2018 - Present)\n\n* Designed and developed a new customer relationship management (CRM) system using Java and Spring Boot.\n* Implemented a microservices architecture to improve application scalability and performance.\n* Led a team of 3 developers in the development of a mobile application for the CRM system.\n\nSoftware Engineer, XYZ Corporation, Anytown, CA (2016 - 2018)\n\n* Developed and maintained a large-scale e-commerce platform using Python and Django.\n* Implemented a search engine optimization (SEO) strategy to improve website traffic and visibility.\n* Worked closely with product managers to gather requirements and design new features.\n\nEducation\n\nBachelor of Science in Computer Science, Anytown University, Anytown, CA (2014)\n\nAwards and Recognition\n\n* Dean's List, Anytown University (2012 - 2014)\n* President's List, Anytown University (2014)\n* Google Code-in Finalist (2013)\n```\n\n**Job Description:**\n\n**Software Engineer**\n\n**Company:** XYZ Corporation\n\n**Location:** Anytown, CA\n\n**Responsibilities:**\n\n* Design, develop, and maintain enterprise-scale software applications\n* Work independently and as part of a team to deliver high-quality software solutions\n* Implement cloud computing technologies (AWS, Azure, GCP)\n* Utilize agile software development methodologies (Scrum, Kanban)\n* Collaborate with product managers to gather requirements and design new features\n\n**Qualifications:**\n\n* Bachelor's degree in Computer Science or related field\n* 5+ years of experience in software development\n* Strong programming skills in Java, Python, or C++\n* Experience with cloud computing technologies (AWS, Azure, GCP)\n* Excellent communication and teamwork skills\n\n**JSON Response:**\n\n```\n{\n  \"positives\": [\n    \"5+ years of experience in software development\",\n    \"Proven ability to work independently and as part of a team\",\n    \"Strong programming skills in Java, Python, and C++\",\n    \"Experience with cloud computing technologies (AWS, Azure, GCP)\",\n    \"Excellent communication and teamwork skills\"\n  ],\n  \"drop\": [],\n  \"add_from_job_description\": [\n    \"Experience with agile software development methodologies (Scrum, Kanban)\"\n  ],\n  \"score\": 90\n}\n```"}],
        },
      ],
    });
  
    const result = await chat.sendMessage(userInput);
    const response = result.response;
    console.log(response.text());
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
