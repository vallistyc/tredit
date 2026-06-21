export default function (plop) {
  plop.setGenerator("page", {
    description: "Generate multiple Next.js pages",

    prompts: [
      {
        type: "input",
        name: "names",
        message: "Masukkan page (pisah spasi atau koma):",
      },
    ],

    actions: function (data) {
      // ubah input jadi array
      const pages = data.names
        .split(/[\s,]+/) // spasi atau koma
        .filter(Boolean);

      return pages.map((name) => ({
        type: "add",
        path: `app/${name}/page.tsx`,
        templateFile: "plop-templates/page.hbs",
        data: { name },
      }));
    },
  });
}