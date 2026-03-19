require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");

const app = express();


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ message: "Collabden API is running" });
});


app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong" });
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`Collabden server running on port ${PORT}`);
});

module.exports = app;
