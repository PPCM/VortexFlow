const axios = require('axios');

async function testAdminAPI() {
  try {
    console.log('🔐 Authentification...');
    
    // 1. Login
    const loginResponse = await axios.post('http://192.168.5.30:5000/api/auth/login', {
      email: 'admin@admin.com',
      password: 'VortexFlow2024!'
    }, {
      withCredentials: true
    });
    
    console.log('✅ Login réussi:', loginResponse.data.user.email);
    
    // 2. Récupérer le cookie de session
    const cookies = loginResponse.headers['set-cookie'];
    const cookieHeader = cookies ? cookies.join('; ') : '';
    
    console.log('🍪 Cookies:', cookieHeader);
    
    // 3. Tester l'API admin/users
    console.log('\n📋 Test API /admin/users...');
    const usersResponse = await axios.get('http://192.168.5.30:5000/api/admin/users', {
      withCredentials: true,
      headers: {
        'Cookie': cookieHeader
      }
    });
    
    console.log('📊 Structure de réponse complète:');
    console.log(JSON.stringify(usersResponse.data, null, 2));
    
    console.log('\n📊 Utilisateurs reçus:');
    if (usersResponse.data.data && usersResponse.data.data.users) {
      console.log('Nombre d\'utilisateurs:', usersResponse.data.data.users.length);
      usersResponse.data.data.users.forEach(u => {
        console.log(`- ${u.email} (${u.role}) - Actif: ${u.is_active}`);
      });
    } else {
      console.log('❌ Pas d\'utilisateurs trouvés ou structure incorrecte');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

testAdminAPI();
