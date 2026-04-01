export const getWelcomeData = (req, res) => {
  res.json({
    title: "Welcome to ServicePro",
    description: "Your one-stop solution for home services",
    services: ["Plumbing", "Cleaning", "Electrical"]
  });
};