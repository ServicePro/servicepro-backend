import Provider from "../models/Provider.js";
import sendEmail from "../utils/sendEmail.js";

// 📥 Get all pending providers
export const getPendingProviders = async (req, res) => {
  try {
    const providers = await Provider.find({ status: "pending" });
    res.json(providers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const approveProvider = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);

    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    provider.status = "approved";
    await provider.save();

    // 📧 Send email
    await sendEmail(
      provider.email,
      "ServicePro Account Approved 🎉",
      `
      <h2>Congratulations ${provider.name}!</h2>
      <p>Your account has been approved.</p>
      <a href="${process.env.FRONTEND_URL}/provider-login">
        Click here to login
      </a>
      `
    );

    res.json({ message: "Provider approved & email sent" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
export const rejectProvider = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);

    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    provider.status = "rejected";
    await provider.save();

    await sendEmail(
      provider.email,
      "ServicePro Application Rejected ❌",
      `
      <h2>Hello ${provider.name}</h2>
      <p>Sorry, your registration was not approved.</p>
      `
    );

    res.json({ message: "Provider rejected & email sent" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};