const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Collabden API",
      version: "1.0.0",
      description: "API documentation for the Collabden backend project.",
      contact: {
        name: "CollabDen Africa",
        url: "https://github.com/CollabDen-Africa",
      },
    },
    servers: [
      {
        url: "http://localhost:5050",
        description: "Development server",
      },
      {
        url: "https://collabden-backend.onrender.com", // Example production URL, adjust as needed
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/modules/*/routes/*.js", "./src/app.js"], // paths to files containing OpenAPI definitions
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
