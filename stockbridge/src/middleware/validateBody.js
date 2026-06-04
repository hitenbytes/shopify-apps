const z = require("zod");

const validateBody = (schemas) => (req, res, next) => {
  try {
    req.body = schemas.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid request body",
        errors: error.issues?.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });
    }
  }
};
module.exports = validateBody;
