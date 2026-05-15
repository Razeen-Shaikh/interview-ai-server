import jwt from "jsonwebtoken";

/** @param {{ _id: unknown; name?: string; email?: string }} user */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: String(user._id),
      name: user.name,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );
};

export default generateToken;
