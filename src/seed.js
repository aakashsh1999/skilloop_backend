// const prisma = require("./prisma");
// async function main() {
//   // Insert a dummy match
//   const newMatch = await prisma.match.create({
//     data: {
//       user1Id: "userId1", // replace with real user IDs or dummy ones
//       user2Id: "userId2",
//       matchedAt: new Date(),
//       approvedByUser1: false,
//       approvedByUser2: false,
//     },
//   });
//   console.log("Created match:", newMatch);
// }

// main()
//   .catch((e) => console.error(e))
//   .finally(async () => {
//     await prisma.$disconnect();
//   });

const { faker } = require("@faker-js/faker");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function createTwentyUsers() {
  const skillTypes = [
    "IT",
    "Design",
    "Marketing",
    "Finance",
    "Healthcare",
    "Education",
  ];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < 20; i++) {
    try {
      const gender = faker.helpers.arrayElement(["male", "female"]);
      const firstName = faker.person.firstName(gender);
      const lastName = faker.person.lastName(gender);
      const fullName = `${firstName} ${lastName}`;

      const uniqueEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${Date.now()}@example.com`;
      const uniqueMobile = `9${faker.string.numeric(9)}`;

      const user = {
        user_type: faker.helpers.arrayElement([
          "Professional",
          "Mentor",
          "Mentee",
        ]),
        name: fullName,
        gender: gender,
        email: uniqueEmail,
        age: faker.number.int({ min: 22, max: 45 }),
        location: "New Delhi",
        latitude: parseFloat(faker.location.latitude({ min: 28.5, max: 28.8 })),
        longitude: parseFloat(
          faker.location.longitude({ min: 77.0, max: 77.3 })
        ),
        profile_image: faker.image.avatar(),
        face: faker.image.urlLoremFlickr({ category: "face" }),
        skills: {
          primary: faker.lorem.word(),
          secondary: faker.lorem.word(),
        },
        anything_but_professional: faker.lorem.sentence(),
        skill_type: faker.helpers.arrayElement(skillTypes),
        short_bio: faker.lorem.sentence(),
        business_card: {
          role: faker.person.jobTitle(),
          company: faker.company.name(),
          phone: uniqueMobile,
          email: uniqueEmail,
        },
        certificates: [
          {
            id: faker.string.uuid(),
            title: `${faker.lorem.word()} Certification`,
            organization: faker.company.name(),
            issueDate: faker.date.past().toISOString(),
            certificateUrl: faker.internet.url(),
          },
        ],
        work_experience: [
          {
            id: faker.string.uuid(),
            position: faker.person.jobTitle(),
            company: faker.company.name(),
            startDate: faker.date.past({ years: 5 }).toISOString(),
            endDate: faker.datatype.boolean()
              ? faker.date.recent().toISOString()
              : null,
            currentlyWorking: faker.datatype.boolean(),
          },
        ],
        mobile_number: uniqueMobile,
        avatar: faker.image.avatar(),
        status: faker.helpers.arrayElement(["On", "Pause", "Off"]),
        expoPushToken: faker.string.alphanumeric(22),
      };

      await prisma.user.create({ data: user });
      console.log(`✅ Created user: ${fullName}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error creating user ${i + 1}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n✅ Success: ${successCount} | ❌ Errors: ${errorCount}`);
  await prisma.$disconnect();
}

createTwentyUsers();
