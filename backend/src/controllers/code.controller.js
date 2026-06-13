exports.runCode = async (
  req,
  res
) => {

  const { code } = req.body;

  console.log(code);

  res.json({
    output:
      "Execution Coming Soon"
  });

};